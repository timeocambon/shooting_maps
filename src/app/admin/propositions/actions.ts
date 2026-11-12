"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { MAX_EXCHANGE_LENGTH } from "@/features/proposals/domain/change-request";
import { decideProposal, type DecisionFailure } from "@/features/proposals/server/proposal-decision";
import { requestProposalChanges } from "@/features/proposals/server/request-changes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  proposalId: z.uuid(),
  decision: z.enum(["approved", "changes_requested", "rejected", "duplicate"]),
  internalNote: z.string().trim().max(2000),
  /** Message au contributeur : obligatoire uniquement pour une demande de précisions. */
  publicMessage: z.string().trim().max(MAX_EXCHANGE_LENGTH),
  displayPrecision: z.enum(["exact", "approximate"]),
  sensitive: z.boolean(),
  /** Version de la fiche affichée (updated_at) : refus si la proposition a changé. */
  version: z.string().max(64),
});

export async function reviewProposalAction(proposalId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = reviewSchema.safeParse({
    proposalId,
    decision: formData.get("decision"),
    internalNote: formData.get("internalNote") ?? "",
    publicMessage: formData.get("publicMessage") ?? "",
    displayPrecision: formData.get("displayPrecision") ?? "exact",
    sensitive: formData.get("sensitive") === "on",
    version: formData.get("version") ?? "",
  });
  if (!parsed.success) redirect(`/admin/propositions/${proposalId}?erreur=validation`);
  if (parsed.data.decision === "changes_requested" && !parsed.data.publicMessage) {
    redirect(`/admin/propositions/${proposalId}?erreur=message-public`);
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.decision === "changes_requested") {
    // Demande de précisions : message public (visible du contributeur) et
    // note interne (moderation_comment, jamais transmise) restent séparés.
    // Logique partagée avec l'administration mobile.
    const result = await requestProposalChanges(supabase, {
      proposalId: parsed.data.proposalId,
      publicMessage: parsed.data.publicMessage,
      internalNote: parsed.data.internalNote,
    });
    if (!result.ok) {
      const code =
        result.reason === "already_reviewed"
          ? "deja-traitee"
          : result.reason === "invalid_message"
            ? "message-public"
            : "decision";
      redirect(`/admin/propositions/${proposalId}?erreur=${code}`);
    }
    revalidatePath("/admin");
    revalidatePath("/admin/propositions");
    redirect(`/admin/propositions?decision=changes_requested`);
  }

  // Publication, refus, doublon : logique partagée avec l'administration mobile
  // (verrou de décision, photos traitées uniquement, nettoyage, e-mail sans note).
  const result = await decideProposal(supabase, {
    proposalId: parsed.data.proposalId,
    decision: parsed.data.decision,
    internalNote: parsed.data.internalNote,
    displayPrecision: parsed.data.displayPrecision,
    sensitive: parsed.data.sensitive,
    expectedVersion: parsed.data.version || null,
  });
  if (!result.ok) {
    redirect(`/admin/propositions/${proposalId}?erreur=${DECISION_ERRORS[result.reason]}`);
  }
  redirect(`/admin/propositions?decision=${parsed.data.decision}`);
}

const DECISION_ERRORS: Record<DecisionFailure, string> = {
  forbidden: "decision",
  not_found: "deja-traitee",
  already_reviewed: "deja-traitee",
  proposal_changed: "modifiee",
  decision_in_progress: "en-cours",
  invalid_photo_count: "photos",
  photo_download_failed: "publication-photos",
  photo_publish_failed: "publication-photos",
  decision_failed: "decision",
};
