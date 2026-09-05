import "server-only";

import { proposalPayloadSchema, type ProposalPayload } from "@/features/proposals/domain/proposal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProposalSummary = {
  id: string;
  trackingId: string;
  name: string;
  municipality: string;
  contributorEmail: string;
  state: string;
  submittedAt: string | null;
  photoCount: number;
};

export type ProposalReview = {
  id: string;
  trackingId: string;
  contributorEmail: string;
  publicPseudonym: string | null;
  state: string;
  submittedAt: string | null;
  payload: ProposalPayload;
  photos: Array<{
    id: string;
    displayOrder: number;
    credit: string | null;
    width: number | null;
    height: number | null;
    byteSize: number | null;
    signedUrl: string;
    moderationState: "pending" | "approved" | "hidden" | "rejected";
  }>;
};

export async function getAdminDashboardCounts() {
  const supabase = await createSupabaseServerClient();
  const [{ error: refreshError }, { error: purgeError }] = await Promise.all([
    supabase.rpc("admin_refresh_review_due_spots"),
    supabase.rpc("admin_purge_expired_proposals"),
  ]);
  if (refreshError) throw refreshError;
  if (purgeError) throw purgeError;
  const [proposals, reports, spots, withdrawals] = await Promise.all([
    supabase.from("proposals").select("id", { count: "exact", head: true }).eq("state", "submitted"),
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("state", "open").eq("priority", "high"),
    supabase.from("spots").select("id", { count: "exact", head: true }).in("publication_state", ["published", "sensitive", "review_due"]),
    supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).in("state", ["open", "in_review"]),
  ]);

  return {
    proposals: proposals.count ?? 0,
    priorityReports: reports.count ?? 0,
    publishedSpots: spots.count ?? 0,
    openWithdrawals: withdrawals.count ?? 0,
  };
}

export async function getModerationQueue(): Promise<ProposalSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, tracking_id, contributor_email, state, submitted_at, payload, proposal_photos(count)")
    .in("state", ["submitted", "changes_requested"])
    .order("submitted_at", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const payload = proposalPayloadSchema.safeParse(row.payload);
    return {
      id: row.id,
      trackingId: row.tracking_id,
      name: payload.success ? payload.data.name : "Proposition invalide",
      municipality: payload.success ? payload.data.municipality : "À contrôler",
      contributorEmail: row.contributor_email,
      state: row.state,
      submittedAt: row.submitted_at,
      photoCount: row.proposal_photos[0]?.count ?? 0,
    };
  });
}

export async function getProposalReview(id: string): Promise<ProposalReview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("id, tracking_id, contributor_email, public_pseudonym, state, submitted_at, payload, proposal_photos(id, display_order, credit, width, height, byte_size, processed_object_path, moderation_state)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const payload = proposalPayloadSchema.safeParse(data.payload);
  if (!payload.success) return null;

  const photos = await Promise.all(
    data.proposal_photos
      .filter((photo) => photo.processed_object_path)
      .sort((left, right) => left.display_order - right.display_order)
      .map(async (photo) => {
        const { data: signed } = await supabase.storage
          .from("spot-originals")
          .createSignedUrl(photo.processed_object_path!, 15 * 60);
        return {
          id: photo.id,
          displayOrder: photo.display_order,
          credit: photo.credit,
          width: photo.width,
          height: photo.height,
          byteSize: photo.byte_size,
          signedUrl: signed?.signedUrl ?? "",
          moderationState: photo.moderation_state,
        };
      }),
  );

  return {
    id: data.id,
    trackingId: data.tracking_id,
    contributorEmail: data.contributor_email,
    publicPseudonym: data.public_pseudonym,
    state: data.state,
    submittedAt: data.submitted_at,
    payload: payload.data,
    photos,
  };
}
