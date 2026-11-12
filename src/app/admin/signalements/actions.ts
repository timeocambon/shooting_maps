"use server";

import { redirect } from "next/navigation";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { decideReport, validateReportDecision } from "@/features/reports/server/report-decision";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function reviewReportAction(reportId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  // Validation et traitement partagés avec l'administration mobile.
  const parsed = validateReportDecision({
    reportId,
    nextState: formData.get("nextState"),
    decision: formData.get("decision") ?? "",
    internalNote: formData.get("internalNote") ?? "",
    hideSpot: formData.get("hideSpot") === "on",
  });
  if (!parsed.ok) redirect(`/admin/signalements/${reportId}?erreur=validation`);

  const supabase = await createSupabaseServerClient();
  const result = await decideReport(supabase, parsed.value);
  if (!result.ok) {
    const reason = result.reason === "already_reviewed" ? "deja-traite" : "traitement";
    redirect(`/admin/signalements/${reportId}?erreur=${reason}`);
  }

  redirect(`/admin/signalements?decision=${parsed.value.nextState}`);
}
