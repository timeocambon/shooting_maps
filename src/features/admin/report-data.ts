import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportSpot = {
  name: string;
  slug: string;
  municipality: string;
  publication_state: string;
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

export type ReportReview = ReportSummary & {
  reporterEmail: string | null;
  decision: string | null;
  internalNote: string | null;
  handledAt: string | null;
};

function readSpot(value: ReportSpot | ReportSpot[]): ReportSpot {
  return Array.isArray(value) ? value[0] : value;
}

export async function getReportQueue(): Promise<ReportSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, reason, priority, state, comment, created_at, spots!inner(name, slug, municipality, publication_state)")
    .in("state", ["open", "in_review"])
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    reason: row.reason,
    priority: row.priority,
    state: row.state,
    comment: row.comment,
    createdAt: row.created_at,
    spot: readSpot(row.spots),
  }));
}

export async function getReportReview(id: string): Promise<ReportReview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, reason, priority, state, comment, reporter_email, decision, internal_note, created_at, handled_at, spots!inner(name, slug, municipality, publication_state)")
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
    spot: readSpot(data.spots),
  };
}
