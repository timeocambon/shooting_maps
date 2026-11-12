import {
  isPublicSpotState,
  reportReasonLabels,
  reportStateLabels,
  spotPublicationStateLabels,
  type ReportReason,
} from "@/features/reports/domain/report";
import type { ReportReview, ReportSummary } from "@/features/admin/report-data";

/**
 * Signalements pour l'administration mobile (lecture seule). Volontairement
 * réduits : ni adresse e-mail de la personne qui signale, ni note interne,
 * ni décision, ni chemin de stockage. Les libellés viennent du site (une
 * seule source de vérité).
 */

export type MobileReportItem = {
  id: string;
  priority: "normal" | "high";
  isHighPriority: boolean;
  reason: string;
  reasonLabel: string;
  state: string;
  stateLabel: string;
  createdAt: string;
  spot: { id: string; name: string; slug: string };
};

export type MobileReportDetail = MobileReportItem & {
  message: string;
  spot: MobileReportItem["spot"] & {
    municipality: string;
    categories: string[];
    publicationState: string;
    publicationStateLabel: string;
    /** Fiche consultable publiquement (site et application). */
    isPublic: boolean;
    /** Chemin de la fiche publique sur le site, `null` si elle n'est pas publique. */
    publicPath: string | null;
    photo: { url: string; alt: string | null; credit: string | null } | null;
  };
};

const reasonLabel = (reason: string) => reportReasonLabels[reason as ReportReason] ?? "Autre motif";
const stateLabel = (state: string) =>
  reportStateLabels[state as keyof typeof reportStateLabels] ?? "À traiter";

function toItem(report: Omit<ReportSummary, "spot">, spot: { id: string; name: string; slug: string }): MobileReportItem {
  return {
    id: report.id,
    priority: report.priority === "high" ? "high" : "normal",
    isHighPriority: report.priority === "high",
    reason: report.reason,
    reasonLabel: reasonLabel(report.reason),
    state: report.state,
    stateLabel: stateLabel(report.state),
    createdAt: report.createdAt,
    spot: { id: spot.id, name: spot.name, slug: spot.slug },
  };
}

export function toMobileReportList(reports: readonly ReportSummary[]) {
  const items = reports.map((report) => toItem(report, report.spot));
  return {
    items,
    count: items.length,
    highPriorityCount: items.filter((item) => item.isHighPriority).length,
  };
}

/** Photo publique : URL HTTPS du bucket public `spot-published` du projet configuré. */
export function isPublicPhotoUrl(url: string, supabaseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const base = new URL(supabaseUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.host === base.host &&
      parsed.pathname.startsWith("/storage/v1/object/public/spot-published/") &&
      !parsed.search
    );
  } catch {
    return false;
  }
}

/** `null` si le spot concerné n'existe plus. */
export function toMobileReportDetail(
  report: ReportReview,
  { supabaseUrl }: { supabaseUrl: string },
): MobileReportDetail | null {
  const spot = report.spot;
  if (!spot) return null;
  const isPublic = isPublicSpotState(spot.publication_state);
  const photo =
    spot.photo && isPublicPhotoUrl(spot.photo.url, supabaseUrl)
      ? { url: spot.photo.url, alt: spot.photo.alt, credit: spot.photo.credit }
      : null;
  return {
    ...toItem(report, spot),
    message: report.comment,
    spot: {
      id: spot.id,
      name: spot.name,
      slug: spot.slug,
      municipality: spot.municipality,
      categories: spot.categories,
      publicationState: spot.publication_state,
      publicationStateLabel: spotPublicationStateLabels[spot.publication_state] ?? "Inconnu",
      isPublic,
      publicPath: isPublic ? `/spots/${spot.slug}` : null,
      photo,
    },
  };
}
