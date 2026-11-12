import { z } from "zod";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import {
  decideProposal,
  type DecisionFailure,
} from "@/features/proposals/server/proposal-decision";

export const runtime = "nodejs";
/** Publication : jusqu'à 6 photos copiées une par une. */
export const maxDuration = 60;

const MAX_NOTE_LENGTH = 2000;

const bodySchema = z
  .object({
    decision: z.enum(["approved", "rejected", "duplicate"]),
    internalNote: z.string().max(MAX_NOTE_LENGTH * 2).optional(),
    displayPrecision: z.enum(["exact", "approximate"]).optional(),
    sensitive: z.boolean().optional(),
    /** `version` de la fiche chargée : refus si la proposition a changé depuis. */
    version: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

const FAILURES: Record<DecisionFailure, { status: number; message: string }> = {
  forbidden: { status: 403, message: "Accès réservé à l’équipe de modération." },
  not_found: { status: 404, message: "Proposition introuvable." },
  already_reviewed: { status: 409, message: "Cette proposition a déjà été traitée." },
  proposal_changed: {
    status: 409,
    message: "La proposition a changé depuis l’ouverture de la fiche. Recharge-la avant de décider.",
  },
  decision_in_progress: {
    status: 409,
    message: "Une décision est déjà en cours pour cette proposition.",
  },
  invalid_photo_count: {
    status: 422,
    message: "La proposition doit contenir entre 2 et 6 photos traitées.",
  },
  photo_download_failed: {
    status: 502,
    message: "Une photo traitée n’a pas pu être lue. Aucune photo n’a été publiée.",
  },
  photo_publish_failed: {
    status: 502,
    message: "Une photo n’a pas pu être publiée. Aucune photo n’est restée publique.",
  },
  decision_failed: { status: 503, message: "La décision n’a pas pu être enregistrée. Réessaie." },
};

function invalid() {
  return mobileAdminJson({ ok: false, error: "invalid_request", message: "Requête invalide." }, 400);
}

/**
 * Décision finale depuis l'application : publication, refus ou doublon.
 * Même logique que le site (`decideProposal`) ; aucun rôle ni état envoyé
 * par l'application n'est pris en compte.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeMobileAdmin(request, "write");
  if (!access.ok) return mobileAdminDenied(access.error);

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) {
    return mobileAdminJson({ ok: false, error: "not_found", message: FAILURES.not_found.message }, 404);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid();
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return invalid();
  const internalNote = (body.data.internalNote ?? "").trim();
  if (internalNote.length > MAX_NOTE_LENGTH) return invalid();
  const approved = body.data.decision === "approved";
  // Publication : précision et caractère sensible choisis explicitement.
  if (approved && (body.data.displayPrecision === undefined || body.data.sensitive === undefined)) {
    return invalid();
  }

  const result = await decideProposal(access.supabase, {
    proposalId: id.data,
    decision: body.data.decision,
    internalNote,
    displayPrecision: approved ? body.data.displayPrecision! : "exact",
    sensitive: approved ? body.data.sensitive! : false,
    expectedVersion: body.data.version ?? null,
  });

  if (!result.ok) {
    const failure = FAILURES[result.reason];
    return mobileAdminJson({ ok: false, error: result.reason, message: failure.message }, failure.status);
  }
  return mobileAdminJson({
    ok: true,
    decision: result.decision,
    state: result.decision,
    spot: result.spot,
    emailSent: result.emailSent,
  });
}
