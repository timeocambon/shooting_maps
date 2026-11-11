import { z } from "zod";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import { MAX_EXCHANGE_LENGTH } from "@/features/proposals/domain/change-request";
import { requestProposalChanges } from "@/features/proposals/server/request-changes";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    publicMessage: z.string().max(MAX_EXCHANGE_LENGTH * 2),
    internalNote: z.string().max(MAX_EXCHANGE_LENGTH * 2).optional(),
  })
  .strict();

/**
 * « Demander des précisions » depuis l'application. Même logique que le site
 * (`admin_request_proposal_changes`) : une seule demande ouverte, donc un
 * second envoi reçoit 409 `already_reviewed` sans rien créer.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeMobileAdmin(request, "write");
  if (!access.ok) return mobileAdminDenied(access.error);

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) {
    return mobileAdminJson(
      { ok: false, error: "not_found", message: "Proposition introuvable." },
      404,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return invalid("invalid_request", "Requête invalide.");
  }
  const body = bodySchema.safeParse(raw);
  if (!body.success) return invalid("invalid_request", "Requête invalide.");

  const publicMessage = body.data.publicMessage.trim();
  const internalNote = (body.data.internalNote ?? "").trim();
  if (!publicMessage || publicMessage.length > MAX_EXCHANGE_LENGTH) {
    return invalid("invalid_message", "Le message au contributeur doit contenir 1 à 2 000 caractères.");
  }
  if (internalNote.length > MAX_EXCHANGE_LENGTH) {
    return invalid("invalid_note", "La note interne est limitée à 2 000 caractères.");
  }

  const result = await requestProposalChanges(access.supabase, {
    proposalId: id.data,
    publicMessage,
    internalNote,
  });
  if (result.ok) {
    return mobileAdminJson({ ok: true, state: "changes_requested", emailSent: result.emailSent });
  }
  switch (result.reason) {
    case "already_reviewed":
      return mobileAdminJson(
        {
          ok: false,
          error: "already_reviewed",
          message: "Cette proposition a déjà été traitée ou attend déjà une réponse.",
        },
        409,
      );
    case "invalid_message":
      return invalid("invalid_message", "Le message au contributeur doit contenir 1 à 2 000 caractères.");
    case "invalid_note":
      return invalid("invalid_note", "La note interne est limitée à 2 000 caractères.");
    case "forbidden":
      return mobileAdminDenied("forbidden");
    default:
      return mobileAdminDenied("unavailable");
  }
}

function invalid(error: string, message: string) {
  return mobileAdminJson({ ok: false, error, message }, 400);
}
