"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withdrawalRequestSchema } from "@/features/withdrawals/domain/withdrawal";

export type WithdrawalActionState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

const errorMessages: Array<[string, string]> = [
  ["invalid_kind", "Choisissez le type de demande."],
  ["invalid_description", "Le message doit contenir entre 10 et 2 000 caractères."],
  ["invalid_email", "L’adresse e-mail n’est pas valide."],
  ["spot_unknown", "Aucune fiche ne correspond à l’adresse indiquée."],
  ["rate_limit", "Trop de demandes ont été envoyées récemment. Réessayez dans une heure."],
];

export async function createWithdrawalRequestAction(
  _previousState: WithdrawalActionState,
  formData: FormData,
): Promise<WithdrawalActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service de retrait n’est pas encore connecté." };
  }

  const parsed = withdrawalRequestSchema.safeParse({
    kind: formData.get("kind"),
    spotSlug: formData.get("spotSlug") ?? "",
    trackingId: formData.get("trackingId") ?? "",
    description: formData.get("description"),
    email: formData.get("email"),
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Certains champs sont incomplets.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_withdrawal_request", {
    p_kind: parsed.data.kind,
    p_spot_slug: parsed.data.spotSlug || null,
    p_tracking_id: parsed.data.trackingId || null,
    p_description: parsed.data.description,
    p_email: parsed.data.email,
    p_website: parsed.data.website,
  });

  if (error || !data) {
    const mapped = errorMessages.find(([code]) => error?.message.includes(code));
    return {
      status: "error",
      message: mapped?.[1] ?? "La demande n’a pas pu être envoyée. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/retraits");

  return { status: "success" };
}
