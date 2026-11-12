import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Traitement d'un signalement, commun à l'administration du site et à
 * l'administration mobile.
 *
 * - Toujours avec la session de l'équipe (cookies du site ou jeton de
 *   l'application) : jamais la clé de service.
 * - `admin_review_report` reste la seule source de vérité : contrôle
 *   d'équipe, verrou de ligne, transitions, masquage du spot (même
 *   transaction), audit. Elle est appelée une seule fois.
 * - Le spot est celui du signalement, retrouvé en base : aucun identifiant
 *   de spot, état précédent ou rôle n'est accepté de l'appelant.
 * - Aucun e-mail n'est envoyé ; la note interne n'est jamais renvoyée ni
 *   journalisée.
 */

export const REPORT_NEXT_STATES = ["in_review", "resolved", "dismissed"] as const;
export type ReportNextState = (typeof REPORT_NEXT_STATES)[number];

export const MAX_REPORT_DECISION_LENGTH = 1000;
export const MAX_REPORT_NOTE_LENGTH = 2000;

export type ReportDecisionInput = {
  reportId: string;
  nextState: ReportNextState;
  decision: string;
  internalNote: string;
  hideSpot: boolean;
};

export type ReportValidationError = "invalid_request" | "decision_required" | "invalid_note";

const inputSchema = z.object({
  reportId: z.uuid(),
  nextState: z.enum(REPORT_NEXT_STATES),
  decision: z.string(),
  internalNote: z.string(),
  hideSpot: z.boolean(),
});

/**
 * Validation commune (mêmes règles que le formulaire du site) : textes
 * nettoyés, décision de 3 à 1000 caractères pour une décision finale,
 * facultative pour une prise en charge, note de 2000 caractères au plus.
 */
export function validateReportDecision(
  raw: unknown,
): { ok: true; value: ReportDecisionInput } | { ok: false; error: ReportValidationError } {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid_request" };
  const decision = parsed.data.decision.trim();
  const internalNote = parsed.data.internalNote.trim();
  if (decision.length > MAX_REPORT_DECISION_LENGTH) return { ok: false, error: "invalid_request" };
  if (internalNote.length > MAX_REPORT_NOTE_LENGTH) return { ok: false, error: "invalid_note" };
  if (parsed.data.nextState !== "in_review" && decision.length < 3) {
    return { ok: false, error: "decision_required" };
  }
  return { ok: true, value: { ...parsed.data, decision, internalNote } };
}

export type ReportDecisionFailure =
  | "forbidden"
  | "not_found"
  | "already_reviewed"
  | "invalid_request"
  | "decision_required"
  | "invalid_note"
  | "decision_failed";

export type ReportDecisionResult =
  | {
      ok: true;
      reportId: string;
      state: ReportNextState;
      /** Spot du signalement (retrouvé par la base) et son masquage effectif. */
      spot: { id: string; hidden: boolean };
    }
  | { ok: false; reason: ReportDecisionFailure };

/** Message d'exception de `admin_review_report` → erreur publique stable. */
export function mapReportReviewError(message: string | undefined): ReportDecisionFailure {
  const reason = message ?? "";
  if (reason.includes("report_already_reviewed")) return "already_reviewed";
  if (reason.includes("report_not_found")) return "not_found";
  if (reason.includes("decision_required")) return "decision_required";
  if (reason.includes("invalid_note")) return "invalid_note";
  if (reason.includes("invalid_decision")) return "invalid_request";
  if (/forbidden/i.test(reason)) return "forbidden";
  return "decision_failed";
}

export type ReportDecisionDeps = { revalidate: (path: string) => void };

export async function decideReport(
  supabase: SupabaseClient<Database>,
  input: ReportDecisionInput,
  deps: Partial<ReportDecisionDeps> = {},
): Promise<ReportDecisionResult> {
  const revalidate = deps.revalidate ?? ((path: string) => revalidatePath(path));

  let spotId: unknown;
  try {
    const { data, error } = await supabase.rpc("admin_review_report", {
      p_report_id: input.reportId,
      p_next_state: input.nextState,
      p_decision: input.decision,
      p_internal_note: input.internalNote,
      p_hide_spot: input.hideSpot,
    });
    if (error) return { ok: false, reason: mapReportReviewError(error.message) };
    spotId = data;
  } catch {
    return { ok: false, reason: "decision_failed" };
  }
  if (typeof spotId !== "string") return { ok: false, reason: "decision_failed" };

  // État effectif du spot après la décision (lecture seule, sous RLS).
  let hidden = false;
  try {
    const { data: spot } = await supabase
      .from("spots")
      .select("publication_state")
      .eq("id", spotId)
      .maybeSingle();
    hidden = spot?.publication_state === "hidden";
  } catch {
    hidden = false;
  }

  try {
    revalidate("/");
    revalidate("/admin");
    revalidate("/admin/signalements");
    revalidate("/admin/spots");
  } catch {
    // Hors contexte Next (tests) : sans effet sur la décision.
  }

  return { ok: true, reportId: input.reportId, state: input.nextState, spot: { id: spotId, hidden } };
}
