/**
 * Échanges publics « Demande de précisions » (table
 * public.proposal_change_requests). La note interne de modération
 * (moderation_comment) n'en fait jamais partie.
 */

/** Longueur maximale du message du modérateur et de la réponse (après trim). */
export const MAX_EXCHANGE_LENGTH = 2000;

/** Clé d'idempotence d'une réponse, générée par l'appareil (16 à 64 caractères). */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

/** Échange tel qu'affiché dans l'administration (jamais transmis au contributeur). */
export type ProposalExchange = {
  id: string;
  publicMessage: string;
  requestedAt: string;
  response: string | null;
  respondedAt: string | null;
  closedAt: string | null;
};

type ExchangeRow = {
  id: string;
  public_message: string;
  requested_at: string;
  response: string | null;
  responded_at: string | null;
  closed_at: string | null;
};

/** Historique trié de la plus ancienne à la plus récente demande. */
export function toExchanges(rows: readonly ExchangeRow[] | null | undefined): ProposalExchange[] {
  return [...(rows ?? [])]
    .sort((left, right) => Date.parse(left.requested_at) - Date.parse(right.requested_at))
    .map((row) => ({
      id: row.id,
      publicMessage: row.public_message,
      requestedAt: row.requested_at,
      response: row.response,
      respondedAt: row.responded_at,
      closedAt: row.closed_at,
    }));
}

/**
 * Vrai si le contributeur vient de répondre : la proposition est revenue
 * dans la file (« submitted ») et la dernière demande a reçu une réponse.
 * Une nouvelle décision (ou une nouvelle demande) fait disparaître l'indication.
 */
export function hasUnreviewedResponse(
  state: string,
  exchanges: readonly Pick<ProposalExchange, "requestedAt" | "respondedAt">[],
): boolean {
  if (state !== "submitted" || exchanges.length === 0) return false;
  const latest = exchanges.reduce((a, b) => (Date.parse(b.requestedAt) > Date.parse(a.requestedAt) ? b : a));
  return latest.respondedAt !== null;
}

/** Échappe un texte libre pour un e-mail HTML (sauts de ligne conservés). */
export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r?\n/g, "<br />");
}
