import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendProposalDecisionEmail } from "@/features/proposals/server/confirmation-email";
import type { Database } from "@/lib/supabase/database.types";

export type RequestChangesResult =
  | { ok: true; emailSent: boolean }
  | {
      ok: false;
      reason: "already_reviewed" | "invalid_message" | "invalid_note" | "forbidden" | "error";
    };

/**
 * « Demander des précisions », commun au site et à l'application mobile.
 *
 * Toute la règle métier est dans `admin_request_proposal_changes` (équipe en
 * AAL2, proposition en vérification, une seule demande ouverte, longueurs,
 * audit). L'appel est fait avec la session de l'équipe (`supabase`), jamais
 * avec la clé de service. L'e-mail ne reçoit que le message public : la note
 * interne n'est jamais transmise.
 */
export async function requestProposalChanges(
  supabase: SupabaseClient<Database>,
  input: { proposalId: string; publicMessage: string; internalNote: string },
  sendEmail: typeof sendProposalDecisionEmail = sendProposalDecisionEmail,
): Promise<RequestChangesResult> {
  const { data: contact } = await supabase
    .from("proposals")
    .select("contributor_email, tracking_id")
    .eq("id", input.proposalId)
    .maybeSingle();

  const { error } = await supabase.rpc("admin_request_proposal_changes", {
    p_proposal_id: input.proposalId,
    p_public_message: input.publicMessage,
    p_internal_note: input.internalNote,
  });
  if (error) {
    const reason = error.message ?? "";
    if (reason.includes("proposal_already_reviewed") || reason.includes("request_already_open")) {
      return { ok: false, reason: "already_reviewed" };
    }
    if (reason.includes("invalid_message")) return { ok: false, reason: "invalid_message" };
    if (reason.includes("invalid_note")) return { ok: false, reason: "invalid_note" };
    if (reason.includes("forbidden")) return { ok: false, reason: "forbidden" };
    return { ok: false, reason: "error" };
  }

  const emailSent = contact
    ? await sendEmail({
        email: contact.contributor_email,
        trackingId: contact.tracking_id,
        decision: "changes_requested",
        publicMessage: input.publicMessage,
      })
    : false;
  return { ok: true, emailSent };
}
