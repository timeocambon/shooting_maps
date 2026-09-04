"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reportSchema } from "@/features/reports/domain/report";

export type ReportActionState =
  | { status: "idle" }
  | { status: "success"; reference: string }
  | { status: "error"; message: string };

const errorMessages: Array<[string, string]> = [
  ["email_required", "Une adresse e-mail est nécessaire pour ce motif."],
  ["rate_limit", "Trop de signalements ont été envoyés récemment. Réessayez dans une heure."],
  ["spot_unavailable", "Cette fiche n’est plus disponible au signalement."],
  ["invalid_email", "L’adresse e-mail n’est pas valide."],
  ["invalid_comment", "Le commentaire doit contenir entre 10 et 2 000 caractères."],
];

export async function createReportAction(
  spotId: string,
  slug: string,
  _previousState: ReportActionState,
  formData: FormData,
): Promise<ReportActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service de signalement n’est pas encore connecté." };
  }

  const parsed = reportSchema.safeParse({
    spotId,
    reason: formData.get("reason"),
    comment: formData.get("comment"),
    email: formData.get("email") ?? "",
    website: formData.get("website") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Certains champs sont incomplets.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_public_report", {
    p_spot_id: parsed.data.spotId,
    p_reason: parsed.data.reason,
    p_comment: parsed.data.comment,
    p_email: parsed.data.email,
    p_website: parsed.data.website,
  });

  if (error || !data) {
    const mapped = errorMessages.find(([code]) => error?.message.includes(code));
    return {
      status: "error",
      message: mapped?.[1] ?? "Le signalement n’a pas pu être envoyé. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/signalements");
  revalidatePath(`/spots/${slug}`);

  return { status: "success", reference: data.slice(0, 8).toUpperCase() };
}
