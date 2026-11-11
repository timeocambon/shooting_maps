/**
 * Statuts publics d'une proposition, exposés par /api/propositions/status.
 * Correspondance (fonction SQL `lookup_proposal_statuses`) :
 *   draft, email_pending → email_pending ; submitted → in_review ;
 *   changes_requested → changes_requested ; approved → published ;
 *   rejected, duplicate, withdrawn → identiques ;
 *   aucune correspondance (numéro inconnu OU mauvais e-mail) → unknown.
 */
export const PUBLIC_PROPOSAL_STATUSES = [
  "email_pending",
  "in_review",
  "changes_requested",
  "published",
  "rejected",
  "duplicate",
  "withdrawn",
  "unknown",
] as const;

export type PublicProposalStatus = (typeof PUBLIC_PROPOSAL_STATUSES)[number];

export const isPublicProposalStatus = (value: unknown): value is PublicProposalStatus =>
  typeof value === "string" && (PUBLIC_PROPOSAL_STATUSES as readonly string[]).includes(value);

/** Éléments acceptés par requête (même limite que la fonction SQL). */
export const MAX_STATUS_ITEMS = 20;

/** Numéro de suivi public : « SPT- » suivi de 10 caractères. */
export const TRACKING_ID_PATTERN = /^SPT-[A-Z0-9]{10}$/;
