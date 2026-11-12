import type { ProposalExchange } from "@/features/proposals/domain/change-request";
import type { ProposalPayload } from "@/features/proposals/domain/proposal";

/**
 * Réponses de l'administration mobile. Volontairement réduites : ni adresse
 * e-mail du contributeur, ni chemin de stockage, ni lien vers un original.
 * Les photos ne sont transmises que par lien signé temporaire.
 */

type QueueSource = {
  id: string;
  trackingId: string;
  name: string;
  municipality: string;
  state: string;
  submittedAt: string | null;
  photoCount: number;
  hasNewResponse: boolean;
};

export type MobileQueueItem = {
  id: string;
  trackingId: string;
  name: string;
  municipality: string;
  state: "submitted" | "changes_requested";
  submittedAt: string | null;
  photoCount: number;
  /** Le contributeur a répondu : nouvelle décision à prendre. */
  hasNewResponse: boolean;
};

/** File : réponses reçues d'abord, puis propositions en vérification, puis demandes en attente. */
export function toMobileQueue(list: readonly QueueSource[]): MobileQueueItem[] {
  const rank = (item: QueueSource) => (item.hasNewResponse ? 0 : item.state === "submitted" ? 1 : 2);
  return list
    .filter(
      (item): item is QueueSource & { state: MobileQueueItem["state"] } =>
        item.state === "submitted" || item.state === "changes_requested",
    )
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => ({
      id: item.id,
      trackingId: item.trackingId,
      name: item.name,
      municipality: item.municipality,
      state: item.state,
      submittedAt: item.submittedAt,
      photoCount: item.photoCount,
      hasNewResponse: item.hasNewResponse,
    }));
}

type ReviewSource = {
  id: string;
  trackingId: string;
  publicPseudonym: string | null;
  state: string;
  submittedAt: string | null;
  payload: ProposalPayload;
  photos: ReadonlyArray<{
    id: string;
    displayOrder: number;
    credit: string | null;
    width: number | null;
    height: number | null;
    signedUrl: string;
  }>;
  exchanges: ProposalExchange[];
  hasNewResponse: boolean;
  internalNote: string | null;
  version: string;
};

export type MobileProposalDetail = {
  id: string;
  trackingId: string;
  state: string;
  submittedAt: string | null;
  publicPseudonym: string | null;
  spot: ProposalPayload;
  photos: Array<{
    id: string;
    url: string;
    expiresAt: string;
    width: number | null;
    height: number | null;
    credit: string | null;
  }>;
  exchanges: ProposalExchange[];
  hasNewResponse: boolean;
  /** Une demande de précisions attend la réponse du contributeur. */
  hasOpenRequest: boolean;
  /** « Demander des précisions » possible (proposition en vérification, aucune demande ouverte). */
  canRequestChanges: boolean;
  /** Note interne : équipe uniquement. */
  internalNote: string | null;
  /** Décision finale possible (proposition en vérification). */
  canDecide: boolean;
  /** Version de la fiche, renvoyée avec la décision (refus si elle a changé). */
  version: string;
};

/** Lien signé de Supabase Storage (`/storage/v1/object/sign/…?token=…`) du projet configuré. */
export function isSignedStorageUrl(url: string, supabaseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(supabaseUrl);
    return (
      parsed.protocol === base.protocol &&
      parsed.host === base.host &&
      parsed.pathname.startsWith("/storage/v1/object/sign/") &&
      parsed.searchParams.has("token")
    );
  } catch {
    return false;
  }
}

export function toMobileDetail(
  review: ReviewSource,
  { now, ttlSeconds, supabaseUrl }: { now: Date; ttlSeconds: number; supabaseUrl: string },
): MobileProposalDetail {
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  const hasOpenRequest = review.exchanges.some((exchange) => exchange.closedAt === null);
  return {
    id: review.id,
    trackingId: review.trackingId,
    state: review.state,
    submittedAt: review.submittedAt,
    publicPseudonym: review.publicPseudonym,
    spot: review.payload,
    photos: review.photos
      .filter((photo) => isSignedStorageUrl(photo.signedUrl, supabaseUrl))
      .map((photo) => ({
        id: photo.id,
        url: photo.signedUrl,
        expiresAt,
        width: photo.width,
        height: photo.height,
        credit: photo.credit,
      })),
    exchanges: review.exchanges,
    hasNewResponse: review.hasNewResponse,
    hasOpenRequest,
    canRequestChanges: review.state === "submitted" && !hasOpenRequest,
    internalNote: review.internalNote,
    canDecide: review.state === "submitted",
    version: review.version,
  };
}

/** Validité des liens de photos envoyés à l'application (10 minutes). */
export const MOBILE_PHOTO_URL_TTL_SECONDS = 10 * 60;
