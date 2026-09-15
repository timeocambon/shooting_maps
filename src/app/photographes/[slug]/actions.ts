"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { photographerReviewSchema } from "@/features/photographers/domain/photographer";

export type PhotographerReviewActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

const errorMessages: Array<[string, string]> = [
  ["photographer_unavailable", "Cette fiche n’est plus disponible aux avis."],
  ["rate_limit", "Trop d’avis ont été envoyés récemment. Réessayez dans une heure."],
  ["invalid_email", "L’adresse e-mail n’est pas valide."],
  ["invalid_comment", "Le commentaire doit contenir entre 10 et 800 caractères."],
  ["invalid_rating", "La note doit être comprise entre 1 et 5."],
];

export async function createPhotographerReviewAction(
  photographerId: string,
  slug: string,
  _previousState: PhotographerReviewActionState,
  formData: FormData,
): Promise<PhotographerReviewActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service d’avis n’est pas encore connecté." };
  }

  const ratingRaw = Number(formData.get("rating"));
  const parsed = photographerReviewSchema.safeParse({
    photographerId,
    rating: Number.isFinite(ratingRaw) ? ratingRaw : 0,
    comment: formData.get("comment"),
    reviewerName: formData.get("reviewerName") ?? "",
    reviewerEmail: formData.get("reviewerEmail") ?? "",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Certains champs sont incomplets.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_public_photographer_review", {
    p_photographer_id: parsed.data.photographerId,
    p_rating: parsed.data.rating,
    p_comment: parsed.data.comment,
    p_reviewer_name: parsed.data.reviewerName,
    p_reviewer_email: parsed.data.reviewerEmail,
    p_website: parsed.data.website,
  });

  if (error) {
    console.error("create_public_photographer_review", error.message);
    const mapped = errorMessages.find(([code]) => error.message.includes(code));
    return {
      status: "error",
      message: mapped?.[1] ?? "L’avis n’a pas pu être envoyé. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/avis");
  revalidatePath(`/photographes/${slug}`);

  return { status: "success" };
}
