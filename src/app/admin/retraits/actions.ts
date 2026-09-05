"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  requestId: z.uuid(),
  nextState: z.enum(["in_review", "resolved", "dismissed"]),
  decision: z.string().trim().max(1000),
  internalNote: z.string().trim().max(2000),
  hideSpot: z.boolean(),
  hidePhotoId: z.union([z.literal(""), z.uuid()]),
}).superRefine((value, context) => {
  if (["resolved", "dismissed"].includes(value.nextState) && value.decision.length < 3) {
    context.addIssue({ code: "custom", path: ["decision"], message: "Une décision est requise." });
  }
});

export async function reviewWithdrawalRequestAction(requestId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    requestId,
    nextState: formData.get("nextState"),
    decision: formData.get("decision") ?? "",
    internalNote: formData.get("internalNote") ?? "",
    hideSpot: formData.get("hideSpot") === "on",
    hidePhotoId: formData.get("hidePhotoId") ?? "",
  });
  if (!parsed.success) redirect(`/admin/retraits/${requestId}?erreur=validation`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_withdrawal_request", {
    p_request_id: parsed.data.requestId,
    p_next_state: parsed.data.nextState,
    p_decision: parsed.data.decision,
    p_internal_note: parsed.data.internalNote,
    p_hide_spot: parsed.data.hideSpot,
    p_hide_photo_id: parsed.data.hidePhotoId || null,
  });

  if (error) {
    let reason = "traitement";
    if (error.message.includes("request_already_reviewed")) reason = "deja-traite";
    else if (error.message.includes("decision_required")) reason = "validation";
    else if (error.message.includes("photo_not_found")) reason = "photo";
    redirect(`/admin/retraits/${requestId}?erreur=${reason}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/retraits");
  revalidatePath("/admin/spots");
  redirect(`/admin/retraits?decision=${parsed.data.nextState}`);
}
