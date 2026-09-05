"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { proposalPayloadSchema } from "@/features/proposals/domain/proposal";
import { sendProposalDecisionEmail } from "@/features/proposals/server/confirmation-email";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  proposalId: z.uuid(),
  decision: z.enum(["approved", "changes_requested", "rejected", "duplicate"]),
  internalNote: z.string().trim().max(2000),
  displayPrecision: z.enum(["exact", "approximate"]),
  sensitive: z.boolean(),
});

export async function reviewProposalAction(proposalId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    proposalId,
    decision: formData.get("decision"),
    internalNote: formData.get("internalNote") ?? "",
    displayPrecision: formData.get("displayPrecision") ?? "exact",
    sensitive: formData.get("sensitive") === "on",
  });
  if (!parsed.success) redirect(`/admin/propositions/${proposalId}?erreur=validation`);

  const supabase = await createSupabaseServerClient();
  const publishedPaths: string[] = [];
  const publicUrls: string[] = [];
  const { data: contact } = await supabase
    .from("proposals")
    .select("contributor_email, tracking_id")
    .eq("id", proposalId)
    .maybeSingle();

  if (parsed.data.decision === "approved") {
    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, state, proposal_photos(processed_object_path, display_order, moderation_state)")
      .eq("id", proposalId)
      .single();
    if (proposalError || proposal.state !== "submitted") {
      redirect(`/admin/propositions/${proposalId}?erreur=deja-traitee`);
    }

    // Une photo exclue pendant la revue (voir setProposalPhotoStateAction)
    // ne doit jamais être publiée, même si l'administrateur approuve le
    // reste de la proposition.
    const photos = proposal.proposal_photos
      .filter((photo) => photo.processed_object_path && photo.moderation_state !== "rejected")
      .sort((left, right) => left.display_order - right.display_order);
    if (photos.length < 2 || photos.length > 6) {
      redirect(`/admin/propositions/${proposalId}?erreur=photos`);
    }

    try {
      for (const [index, photo] of photos.entries()) {
        const { data: image, error: downloadError } = await supabase.storage
          .from("spot-originals")
          .download(photo.processed_object_path!);
        if (downloadError) throw downloadError;

        const publicPath = `spots/${proposalId}/${String(index + 1).padStart(2, "0")}.webp`;
        const { error: uploadError } = await supabase.storage
          .from("spot-published")
          .upload(publicPath, await image.arrayBuffer(), {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: false,
          });
        if (uploadError) throw uploadError;
        publishedPaths.push(publicPath);
        publicUrls.push(supabase.storage.from("spot-published").getPublicUrl(publicPath).data.publicUrl);
      }
    } catch {
      if (publishedPaths.length) await supabase.storage.from("spot-published").remove(publishedPaths);
      redirect(`/admin/propositions/${proposalId}?erreur=publication-photos`);
    }
  }

  const { error } = await supabase.rpc("admin_review_proposal", {
    p_proposal_id: parsed.data.proposalId,
    p_decision: parsed.data.decision,
    p_internal_note: parsed.data.internalNote,
    p_display_precision: parsed.data.displayPrecision,
    p_sensitive: parsed.data.sensitive,
    p_published_paths: publishedPaths,
    p_public_urls: publicUrls,
  });

  if (error) {
    if (publishedPaths.length) await supabase.storage.from("spot-published").remove(publishedPaths);
    const code = error.message.includes("proposal_already_reviewed") ? "deja-traitee" : "decision";
    redirect(`/admin/propositions/${proposalId}?erreur=${code}`);
  }

  if (contact) {
    await sendProposalDecisionEmail({
      email: contact.contributor_email,
      trackingId: contact.tracking_id,
      decision: parsed.data.decision,
    });
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/propositions");
  redirect(`/admin/propositions?decision=${parsed.data.decision}`);
}

// Corrige le contenu d'une proposition (champs saisis par le contributeur)
// avant décision — utile quand l'information est bonne sur le fond mais
// mal orthographiée, mal catégorisée ou légèrement mal positionnée, sans
// avoir à renvoyer le contributeur remplir un nouveau formulaire.
const correctionSchema = proposalPayloadSchema
  .omit({ accessWithoutTrespass: true })
  .extend({ internalNote: z.string().trim().max(2000) });

export async function correctProposalAction(proposalId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = correctionSchema.safeParse({
    address: formData.get("address"),
    latitude: Number(formData.get("latitude")),
    longitude: Number(formData.get("longitude")),
    municipality: formData.get("municipality"),
    postalCode: formData.get("postalCode"),
    displayPrecision: formData.get("displayPrecision"),
    name: formData.get("name"),
    categories: formData.getAll("categories"),
    shortDescription: formData.get("shortDescription"),
    bestTimes: formData.getAll("bestTimes"),
    visualFeatures: formData.get("visualFeatures") ?? "",
    accessLevel: formData.get("accessLevel"),
    parking: formData.get("parking"),
    walkingApproach: formData.get("walkingApproach"),
    surfaceType: formData.get("surfaceType"),
    traffic: formData.get("traffic"),
    attendance: formData.get("attendance"),
    risks: formData.get("risks"),
    locationStatus: formData.get("locationStatus"),
    internalNote: formData.get("internalNote") ?? "",
  });
  if (!parsed.success) redirect(`/admin/propositions/${proposalId}?erreur=correction`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_correct_proposal", {
    p_proposal_id: proposalId,
    p_name: parsed.data.name,
    p_address: parsed.data.address,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_municipality: parsed.data.municipality,
    p_postal_code: parsed.data.postalCode,
    p_payload_display_precision: parsed.data.displayPrecision,
    p_categories: parsed.data.categories,
    p_short_description: parsed.data.shortDescription,
    p_best_times: parsed.data.bestTimes,
    p_visual_features: parsed.data.visualFeatures,
    p_access_level: parsed.data.accessLevel,
    p_parking: parsed.data.parking,
    p_walking_approach: parsed.data.walkingApproach,
    p_surface_type: parsed.data.surfaceType,
    p_traffic: parsed.data.traffic,
    p_attendance: parsed.data.attendance,
    p_risks: parsed.data.risks,
    p_location_status: parsed.data.locationStatus,
    p_internal_note: parsed.data.internalNote,
  });

  if (error) {
    const code = error.message.includes("proposal_not_correctable") ? "deja-traitee" : "correction";
    redirect(`/admin/propositions/${proposalId}?erreur=${code}`);
  }

  revalidatePath(`/admin/propositions/${proposalId}`);
  redirect(`/admin/propositions/${proposalId}?maj=correction`);
}

// Exclut ou réintègre une photo précise d'une proposition, sans toucher au
// reste : utile quand une photo pose un problème (personne reconnaissable,
// hors sujet, doublon d'une autre) mais que la proposition reste valable.
const photoStateSchema = z.object({
  photoId: z.uuid(),
  etat: z.enum(["pending", "approved", "rejected"]),
});

export async function setProposalPhotoStateAction(proposalId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = photoStateSchema.safeParse({
    photoId: formData.get("photoId"),
    etat: formData.get("etat"),
  });
  if (!parsed.success) redirect(`/admin/propositions/${proposalId}?erreur=photo`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_proposal_photo_state", {
    p_photo_id: parsed.data.photoId,
    p_moderation_state: parsed.data.etat,
  });

  if (error) redirect(`/admin/propositions/${proposalId}?erreur=photo`);

  revalidatePath(`/admin/propositions/${proposalId}`);
  redirect(`/admin/propositions/${proposalId}`);
}
