import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compareReportsForQueue,
  OPEN_REPORT_STATES,
} from "@/features/reports/domain/report";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lecture des signalements pour l'équipe, commune au site et à
 * l'administration mobile. Toujours avec la session de l'équipe (cookies du
 * site ou jeton de l'application) : les politiques RLS (`private.is_staff()`)
 * s'appliquent, jamais la clé de service.
 */
type StaffClient = SupabaseClient<Database>;

type ReportSpot = {
  id: string;
  name: string;
  slug: string;
  municipality: string;
  publication_state: string;
};

export type ReportSpotDetail = ReportSpot & {
  categories: string[];
  /** Première photo publique approuvée (URL publique du bucket `spot-published`). */
  photo: { url: string; alt: string | null; credit: string | null } | null;
};

export type ReportSummary = {
  id: string;
  reason: string;
  priority: "normal" | "high";
  state: string;
  comment: string;
  createdAt: string;
  spot: ReportSpot;
};

export type ReportReview = Omit<ReportSummary, "spot"> & {
  reporterEmail: string | null;
  decision: string | null;
  internalNote: string | null;
  handledAt: string | null;
  /** `null` si le spot n'existe plus ou n'est pas lisible. */
  spot: ReportSpotDetail | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const SPOT_FIELDS = "id, name, slug, municipality, publication_state";

export async function getReportQueue(client?: StaffClient): Promise<ReportSummary[]> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("reports")
    .select(`id, reason, priority, state, comment, created_at, spots!inner(${SPOT_FIELDS})`)
    .in("state", [...OPEN_REPORT_STATES])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row): Omit<ReportSummary, "spot"> & { spot: ReportSpot | null } => ({
      id: row.id,
      reason: row.reason,
      priority: row.priority,
      state: row.state,
      comment: row.comment,
      createdAt: row.created_at,
      spot: one(row.spots as ReportSpot | ReportSpot[]),
    }))
    .filter((report): report is ReportSummary => report.spot !== null)
    .sort(compareReportsForQueue);
}

type SpotRow = ReportSpot & {
  spot_categories?: Array<{ categories: { label: string } | { label: string }[] | null }> | null;
  spot_photos?: Array<{
    public_url: string | null;
    alt_text: string | null;
    credit: string | null;
    display_order: number;
    moderation_state: string;
    removed_at: string | null;
  }> | null;
};

function readSpotDetail(value: SpotRow | SpotRow[] | null | undefined): ReportSpotDetail | null {
  const spot = one(value);
  if (!spot) return null;
  const photo = (spot.spot_photos ?? [])
    .filter((p) => p.public_url && p.moderation_state === "approved" && !p.removed_at)
    .sort((left, right) => left.display_order - right.display_order)[0];
  return {
    id: spot.id,
    name: spot.name,
    slug: spot.slug,
    municipality: spot.municipality,
    publication_state: spot.publication_state,
    categories: (spot.spot_categories ?? [])
      .map((link) => one(link.categories)?.label)
      .filter((label): label is string => Boolean(label)),
    photo: photo ? { url: photo.public_url!, alt: photo.alt_text, credit: photo.credit } : null,
  };
}

export async function getReportReview(id: string, client?: StaffClient): Promise<ReportReview | null> {
  const supabase = client ?? (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("reports")
    .select(
      `id, reason, priority, state, comment, reporter_email, decision, internal_note, created_at, handled_at, spots(${SPOT_FIELDS}, spot_categories(categories(label)), spot_photos(public_url, alt_text, credit, display_order, moderation_state, removed_at))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    reason: data.reason,
    priority: data.priority,
    state: data.state,
    comment: data.comment,
    reporterEmail: data.reporter_email,
    decision: data.decision,
    internalNote: data.internal_note,
    createdAt: data.created_at,
    handledAt: data.handled_at,
    spot: readSpotDetail(data.spots as unknown as SpotRow | SpotRow[] | null),
  };
}
