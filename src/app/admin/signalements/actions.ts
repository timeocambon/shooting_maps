"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  reportId: z.uuid(),
  nextState: z.enum(["in_review", "resolved", "dismissed"]),
  decision: z.string().trim().max(1000),
  internalNote: z.string().trim().max(2000),
  hideSpot: z.boolean(),
}).superRefine((value, context) => {
  if (["resolved", "dismissed"].includes(value.nextState) && value.decision.length < 3) {
    context.addIssue({ code: "custom", path: ["decision"], message: "Une décision est requise." });
  }
});

export async function reviewReportAction(reportId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    reportId,
    nextState: formData.get("nextState"),
    decision: formData.get("decision") ?? "",
    internalNote: formData.get("internalNote") ?? "",
    hideSpot: formData.get("hideSpot") === "on",
  });
  if (!parsed.success) redirect(`/admin/signalements/${reportId}?erreur=validation`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_report", {
    p_report_id: parsed.data.reportId,
    p_next_state: parsed.data.nextState,
    p_decision: parsed.data.decision,
    p_internal_note: parsed.data.internalNote,
    p_hide_spot: parsed.data.hideSpot,
  });

  if (error) {
    const reason = error.message.includes("report_already_reviewed") ? "deja-traite" : "traitement";
    redirect(`/admin/signalements/${reportId}?erreur=${reason}`);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/signalements");
  revalidatePath("/admin/spots");
  redirect(`/admin/signalements?decision=${parsed.data.nextState}`);
}
