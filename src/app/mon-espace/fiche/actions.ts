"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { socialLinkSchema } from "@/features/photographers/domain/photographer";

export type ProfileEditState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

const editSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(10).max(160),
  bio: z.string().trim().min(20).max(2000),
  locationLabel: z.string().trim().max(120),
  socials: z.array(socialLinkSchema).min(1).max(5),
});

const errorMessages: Array<[string, string]> = [
  ["not_owner", "Cette fiche ne vous appartient pas."],
  ["invalid_name", "Le nom doit contenir entre 2 et 80 caractères."],
  ["invalid_tagline", "La présentation courte doit contenir entre 10 et 160 caractères."],
  ["invalid_bio", "Le texte de présentation doit contenir entre 20 et 2 000 caractères."],
  ["invalid_socials", "Indiquez au moins un réseau social valide."],
];

export async function updateMyPhotographerProfileAction(
  _previousState: ProfileEditState,
  formData: FormData,
): Promise<ProfileEditState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service n’est pas encore connecté." };
  }

  let socials: unknown = [];
  try {
    socials = JSON.parse(String(formData.get("socials") ?? "[]"));
  } catch {
    return { status: "error", message: "Les réseaux sociaux sont mal formés." };
  }

  const parsed = editSchema.safeParse({
    name: formData.get("name"),
    tagline: formData.get("tagline"),
    bio: formData.get("bio"),
    locationLabel: formData.get("locationLabel") ?? "",
    socials,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Certains champs sont incomplets.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_my_photographer_profile", {
    p_name: parsed.data.name,
    p_tagline: parsed.data.tagline,
    p_bio: parsed.data.bio,
    p_location_label: parsed.data.locationLabel,
    p_socials: parsed.data.socials,
  });

  if (error) {
    console.error("update_my_photographer_profile", error.message);
    const mapped = errorMessages.find(([code]) => error.message.includes(code));
    return {
      status: "error",
      message: mapped?.[1] ?? "L’enregistrement a échoué. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/mon-espace", "layout");
  revalidatePath("/photographes", "layout");

  return { status: "success" };
}
