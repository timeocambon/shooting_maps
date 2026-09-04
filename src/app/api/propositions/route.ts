import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { proposalSubmissionSchema } from "@/features/proposals/domain/proposal";
import { sendProposalConfirmationEmail } from "@/features/proposals/server/confirmation-email";
import { processProposalImage } from "@/features/proposals/server/image-processing";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export const runtime = "nodejs";

function hashCapability(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return errorResponse("Le service de contribution n'est pas encore configuré.", 503);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("L'envoi n'a pas pu être lu. Réessayez avec des fichiers plus légers.");
  }

  const payloadValue = formData.get("payload");
  let payload: unknown;
  try {
    payload = typeof payloadValue === "string" ? JSON.parse(payloadValue) : null;
  } catch {
    return errorResponse("Les informations du formulaire sont invalides.");
  }

  const parsed = proposalSubmissionSchema.safeParse({
    payload,
    email: formData.get("email"),
    pseudonym: formData.get("pseudonym") ?? "",
    photoCredit: formData.get("photoCredit") ?? "",
    rightsDeclared: formData.get("rightsDeclared") === "true",
    peopleConfirmed: formData.get("peopleConfirmed") === "true",
    charterAccepted: formData.get("charterAccepted") === "true",
    termsAccepted: formData.get("termsAccepted") === "true",
    privacyAccepted: formData.get("privacyAccepted") === "true",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return errorResponse("Certains champs sont incomplets ou invalides.");
  }

  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length < 2 || files.length > 6) {
    return errorResponse("Ajoutez entre 2 et 6 photos.");
  }

  if (files.reduce((total, file) => total + file.size, 0) > 45 * 1024 * 1024) {
    return errorResponse("L'ensemble des photos dépasse la limite de 45 Mo.");
  }

  const emailToken = randomBytes(32).toString("base64url");
  const uploadSecret = randomBytes(32).toString("base64url");
  const supabase = createSupabasePublicServerClient();
  const { data: proposalRows, error: proposalError } = await supabase.rpc(
    "create_public_proposal",
    {
      p_payload: parsed.data.payload,
      p_email: parsed.data.email,
      p_pseudonym: parsed.data.pseudonym,
      p_email_token_hash: hashCapability(emailToken),
      p_upload_secret_hash: hashCapability(uploadSecret),
      p_rights_declared: parsed.data.rightsDeclared,
      p_people_confirmed: parsed.data.peopleConfirmed,
      p_charter_accepted: parsed.data.charterAccepted,
      p_terms_accepted: parsed.data.termsAccepted,
      p_privacy_accepted: parsed.data.privacyAccepted,
    },
  );

  const proposal = proposalRows?.[0];
  if (proposalError || !proposal) {
    const limited = proposalError?.message.includes("rate_limit");
    return errorResponse(
      limited
        ? "Trop de propositions ont été envoyées récemment avec cette adresse. Réessayez dans une heure."
        : "La proposition n'a pas pu être créée.",
      limited ? 429 : 500,
    );
  }

  const uploadedPaths: string[] = [];

  try {
    for (const [index, file] of files.entries()) {
      const image = await processProposalImage(Buffer.from(await file.arrayBuffer()));
      const fileId = randomUUID();
      const basePath = `proposals/${proposal.proposal_id}/${uploadSecret}`;
      const originalPath = `${basePath}/original-${index}-${fileId}.${image.originalExtension}`;
      const processedPath = `${basePath}/processed-${index}-${fileId}.webp`;

      const { error: originalError } = await supabase.storage
        .from("spot-originals")
        .upload(originalPath, image.originalBytes, {
          contentType: image.detectedMimeType,
          cacheControl: "0",
          upsert: false,
        });
      if (originalError) throw originalError;
      uploadedPaths.push(originalPath);

      const { error: processedError } = await supabase.storage
        .from("spot-originals")
        .upload(processedPath, image.processedBytes, {
          contentType: "image/webp",
          cacheControl: "0",
          upsert: false,
        });
      if (processedError) throw processedError;
      uploadedPaths.push(processedPath);

      const { error: photoError } = await supabase.rpc("attach_proposal_photo", {
        p_proposal_id: proposal.proposal_id,
        p_upload_secret: uploadSecret,
        p_original_path: originalPath,
        p_processed_path: processedPath,
        p_display_order: index,
        p_credit: parsed.data.photoCredit,
        p_detected_mime_type: image.detectedMimeType,
        p_byte_size: image.byteSize,
        p_width: image.width,
        p_height: image.height,
      });
      if (photoError) throw photoError;
    }
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from("spot-originals").remove(uploadedPaths);
    }
    await supabase.rpc("abandon_public_proposal", {
      p_proposal_id: proposal.proposal_id,
      p_upload_secret: uploadSecret,
    });

    const reason = error instanceof Error ? error.message : "upload_failed";
    const imageMessage = reason.includes("image_too_small")
      ? "Chaque photo doit mesurer au moins 1000 × 600 pixels."
      : reason.includes("invalid_file_size")
        ? "Chaque photo doit peser moins de 15 Mo."
        : "Une photo est illisible ou son format n'est pas accepté.";
    return errorResponse(imageMessage);
  }

  const emailResult = await sendProposalConfirmationEmail({
    email: parsed.data.email,
    trackingId: proposal.tracking_id,
    token: emailToken,
  });

  if (emailResult.sent) {
    await supabase.rpc("mark_proposal_confirmation_sent", {
      p_proposal_id: proposal.proposal_id,
      p_upload_secret: uploadSecret,
    });
  }

  return NextResponse.json({
    ok: true,
    trackingId: proposal.tracking_id,
    emailSent: emailResult.sent,
    developmentConfirmationUrl: emailResult.developmentConfirmationUrl,
  });
}
