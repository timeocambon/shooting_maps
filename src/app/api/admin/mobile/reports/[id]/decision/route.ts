import { z } from "zod";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import {
  decideReport,
  REPORT_NEXT_STATES,
  validateReportDecision,
  type ReportDecisionFailure,
} from "@/features/reports/server/report-decision";

export const runtime = "nodejs";

/**
 * Corps strict : aucun identifiant de spot, état précédent ou rôle n'est
 * accepté. Les longueurs brutes sont bornées ici ; les règles métier
 * (décision, note) sont celles du module partagé.
 */
const bodySchema = z
  .object({
    nextState: z.enum(REPORT_NEXT_STATES),
    decision: z.string().max(4000),
    internalNote: z.string().max(8000),
    hideSpot: z.boolean(),
  })
  .strict();

const FAILURES: Record<ReportDecisionFailure, { status: number; message: string }> = {
  invalid_request: { status: 400, message: "Requête invalide." },
  forbidden: { status: 403, message: "Accès réservé à l’équipe de modération." },
  not_found: { status: 404, message: "Signalement introuvable." },
  already_reviewed: { status: 409, message: "Ce signalement a déjà été traité." },
  decision_required: {
    status: 422,
    message: "Indique une décision ou un motif d’au moins 3 caractères (1 000 au plus).",
  },
  invalid_note: { status: 422, message: "La note interne est limitée à 2 000 caractères." },
  decision_failed: { status: 503, message: "La décision n’a pas pu être enregistrée. Réessaie." },
};

function failure(reason: ReportDecisionFailure) {
  const { status, message } = FAILURES[reason];
  return mobileAdminJson({ ok: false, error: reason, message }, status);
}

/**
 * Traitement d'un signalement depuis l'application : prise en charge,
 * résolution ou classement sans suite, avec masquage éventuel de la fiche.
 * Même logique que le site (`decideReport` → `admin_review_report`).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeMobileAdmin(request, "write");
  if (!access.ok) return mobileAdminDenied(access.error);

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return failure("not_found");

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return failure("invalid_request");
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return failure("invalid_request");

  const input = validateReportDecision({ reportId: id.data, ...body.data });
  if (!input.ok) return failure(input.error);

  const result = await decideReport(access.supabase, input.value);
  if (!result.ok) return failure(result.reason);

  return mobileAdminJson({
    ok: true,
    reportId: result.reportId,
    state: result.state,
    spot: { id: result.spot.id, hidden: result.spot.hidden },
  });
}
