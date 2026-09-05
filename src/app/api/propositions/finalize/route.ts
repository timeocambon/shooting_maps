import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sendProposalConfirmationEmail } from "@/features/proposals/server/confirmation-email";
import { processProposalImage } from "@/features/proposals/server/image-processing";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { createSupabaseServiceRoleClient, isServiceRoleConfigured } from "@/lib/supabase/service-role-server";

export const runtime = "nodejs";

const bodySchema = z.object({
  proposalId: z.string().min(1),
  uploadSecret: z.string().min(1),
  emailToken: z.string().min(1),
  trackingId: z.string().min(1),
  email: z.email().max(320),
  photoCredit: z.string().trim().max(120),
  photos: z
    .array(
      z.object({
        path: z.string().min(1),
        index: z.number().int().min(0).max(5),
      }),
    )
    .min(2)
    .max(6),
});

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Étape 3/3 : une fois toutes les photos envoyées vers des chemins temporaires
// (voir /photos), cette fonction récupère chaque fichier, le traite avec sharp
// comme avant, le dépose à son emplacement définitif, puis finalise la
// proposition et envoie l'e-mail de confirmation.
//
// La clé de service (qui contourne les policies RLS) n'est utilisée QUE pour
// télécharger la photo temporaire : c'est la seule opération qui n'a pas de
// policy RLS anonyme (la lecture du bucket "spot-originals" n'est pas
// publique). Tout le reste (upload, RPC, suppression) repasse par le client
// public/anon habituel, qui est déjà autorisé pour ces opérations par les
// policies existantes — comme le faisait le code d'origine.
export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return errorResponse("Le service de contribution n'est pas encore configuré.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Requête invalide.");
  }

  const { proposalId, uploadSecret, emailToken, trackingId, email, photoCredit, photos } =
    parsed.data;

  const supabase = createSupabasePublicServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const tempPaths = photos.map((photo) => photo.path);
  const finalPaths: string[] = [];

  try {
    for (const photo of photos) {
      const { data: downloaded, error: downloadError } = await serviceSupabase.storage
        .from("spot-originals")
        .download(photo.path);
      if (downloadError || !downloaded) {
        console.error("[api/propositions/finalize] download_failed", {
          path: photo.path,
          error: downloadError,
        });
        throw new Error("upload_failed");
      }

      let image;
      try {
        image = await processProposalImage(Buffer.from(await downloaded.arrayBuffer()));
      } catch (processError) {
        console.error("[api/propositions/finalize] process_failed", {
          path: photo.path,
          error: processError instanceof Error ? processError.message : processError,
        });
        throw processError;
      }

      const fileId = randomUUID();
      const basePath = `proposals/${proposalId}/${uploadSecret}`;
      const originalPath = `${basePath}/original-${photo.index}-${fileId}.${image.originalExtension}`;
      const processedPath = `${basePath}/processed-${photo.index}-${fileId}.webp`;

      const { error: originalError } = await supabase.storage
        .from("spot-originals")
        .upload(originalPath, image.originalBytes, {
          contentType: image.detectedMimeType,
          cacheControl: "0",
          upsert: false,
        });
      if (originalError) {
        console.error("[api/propositions/finalize] upload_original_failed", originalError);
        throw originalError;
      }
      finalPaths.push(originalPath);

      const { error: processedError } = await supabase.storage
        .from("spot-originals")
        .upload(processedPath, image.processedBytes, {
          contentType: "image/webp",
          cacheControl: "0",
          upsert: false,
        });
      if (processedError) {
        console.error("[api/propositions/finalize] upload_processed_failed", processedError);
        throw processedError;
      }
      finalPaths.push(processedPath);

      const { error: photoError } = await supabase.rpc("attach_proposal_photo", {
        p_proposal_id: proposalId,
        p_upload_secret: uploadSecret,
        p_original_path: originalPath,
        p_processed_path: processedPath,
        p_display_order: photo.index,
        p_credit: photoCredit,
        p_detected_mime_type: image.detectedMimeType,
        p_byte_size: image.byteSize,
        p_width: image.width,
        p_height: image.height,
      });
      if (photoError) {
        console.error("[api/propositions/finalize] attach_failed", photoError);
        throw photoError;
      }
    }
  } catch (error) {
    console.error("[api/propositions/finalize] failed", {
      message: error instanceof Error ? error.message : error,
    });
    if (finalPaths.length) {
      await supabase.storage.from("spot-originals").remove(finalPaths);
    }
    await supabase.storage.from("spot-originals").remove(tempPaths);
    await supabase.rpc("abandon_public_proposal", {
      p_proposal_id: proposalId,
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

  await supabase.storage.from("spot-originals").remove(tempPaths);

  const emailResult = await sendProposalConfirmationEmail({
    email,
    trackingId,
    token: emailToken,
  });

  if (emailResult.sent) {
    await supabase.rpc("mark_proposal_confirmation_sent", {
      p_proposal_id: proposalId,
      p_upload_secret: uploadSecret,
    });
  }

  return NextResponse.json({
    ok: true,
    trackingId,
    emailSent: emailResult.sent,
    developmentConfirmationUrl: emailResult.developmentConfirmationUrl,
  });
}
