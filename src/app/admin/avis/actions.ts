"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  reviewId: z.uuid(),
  photographerSlug: z.string().min(1),
  moderationState: z.enum(["approved", "rejected"]),
});

export async function reviewPhotographerReviewAction(formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    reviewId: formData.get("reviewId"),
    photographerSlug: formData.get("photographerSlug"),
    moderationState: formData.get("moderationState"),
  });
  if (!parsed.success) redirect("/admin/avis?erreur=validation");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_photographer_review", {
    p_review_id: parsed.data.reviewId,
    p_moderation_state: parsed.data.moderationState,
  });

  if (error) {
    console.error("admin_review_photographer_review", error.message);
    redirect("/admin/avis?erreur=traitement");
  }

  revalidatePath("/admin/avis");
  revalidatePath("/admin");
  // « layout » régénère aussi l'annuaire : la note moyenne et le nombre d'avis
  // s'affichent sur les cartes de /photographes, pas seulement sur la fiche.
  revalidatePath("/photographes", "layout");
  redirect(`/admin/avis?decision=${parsed.data.moderationState}`);
}
