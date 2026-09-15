"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  photographerId: z.uuid(),
  decision: z.enum(["published", "rejected"]),
  internalNote: z.string().trim().max(2000),
});

export async function reviewPhotographerAction(photographerId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    photographerId,
    decision: formData.get("decision"),
    internalNote: formData.get("internalNote") ?? "",
  });
  if (!parsed.success) redirect(`/admin/photographes/${photographerId}?erreur=validation`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_photographer", {
    p_photographer_id: parsed.data.photographerId,
    p_decision: parsed.data.decision,
    p_internal_note: parsed.data.internalNote,
  });

  if (error) {
    const reason = error.message.includes("already_reviewed") ? "deja-traite" : "traitement";
    redirect(`/admin/photographes/${photographerId}?erreur=${reason}`);
  }

  revalidatePath("/");
  revalidatePath("/photographes");
  revalidatePath("/admin");
  revalidatePath("/admin/photographes");
  redirect(`/admin/photographes?decision=${parsed.data.decision}`);
}

const photoStateSchema = z.object({
  photoId: z.uuid(),
  photographerId: z.uuid(),
  moderationState: z.enum(["approved", "hidden"]),
});

export async function setPhotographerPhotoStateAction(formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = photoStateSchema.safeParse({
    photoId: formData.get("photoId"),
    photographerId: formData.get("photographerId"),
    moderationState: formData.get("moderationState"),
  });
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("admin_set_photographer_photo_state", {
    p_photo_id: parsed.data.photoId,
    p_moderation_state: parsed.data.moderationState,
  });

  revalidatePath("/photographes");
  revalidatePath(`/admin/photographes/${parsed.data.photographerId}`);
}

const stateSchema = z.object({
  photographerId: z.uuid(),
  state: z.enum(["published", "hidden"]),
});

export async function setPhotographerStateAction(formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = stateSchema.safeParse({
    photographerId: formData.get("photographerId"),
    state: formData.get("state"),
  });
  if (!parsed.success) return;

  const supabase = await createSupabaseServerClient();
  await supabase.rpc("admin_set_photographer_state", {
    p_photographer_id: parsed.data.photographerId,
    p_state: parsed.data.state,
  });

  revalidatePath("/photographes");
  revalidatePath(`/admin/photographes/${parsed.data.photographerId}`);
}
