"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
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
      .select("id, state, proposal_photos(processed_object_path, display_order)")
      .eq("id", proposalId)
      .single();
    if (proposalError || proposal.state !== "submitted") {
      redirect(`/admin/propositions/${proposalId}?erreur=deja-traitee`);
    }

    const photos = proposal.proposal_photos
      .filter((photo) => photo.processed_object_path)
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
