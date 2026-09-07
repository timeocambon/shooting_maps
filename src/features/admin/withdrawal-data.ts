import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type WithdrawalSpot = {
  id: string;
  name: string;
  slug: string;
  municipality: string;
  publication_state: string;
};

export type WithdrawalSummary = {
  id: string;
  kind: "photo" | "data";
  state: string;
  description: string;
  createdAt: string;
  spot: WithdrawalSpot | null;
};

export type WithdrawalPhoto = {
  id: string;
  displayOrder: number;
  publicUrl: string | null;
  moderationState: "pending" | "approved" | "hidden" | "rejected";
};

export type WithdrawalReview = WithdrawalSummary & {
  trackingId: string | null;
  requesterEmail: string;
  decision: string | null;
  internalNote: string | null;
  handledAt: string | null;
  spotPhotos: WithdrawalPhoto[];
};

function readSpot(value: WithdrawalSpot | WithdrawalSpot[] | null): WithdrawalSpot | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getWithdrawalQueue(): Promise<WithdrawalSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("id, kind, state, description, created_at, spots(id, name, slug, municipality, publication_state)")
    .in("state", ["open", "in_review"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as WithdrawalSummary["kind"],
    state: row.state,
    description: row.description,
    createdAt: row.created_at,
    spot: readSpot(row.spots),
  }));
}

export async function getWithdrawalReview(id: string): Promise<WithdrawalReview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, kind, state, description, requester_email, decision, internal_note, proposal_tracking_id, created_at, handled_at, spots(id, name, slug, municipality, publication_state)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const spot = readSpot(data.spots);
  let spotPhotos: WithdrawalPhoto[] = [];

  if (spot) {
    const { data: photos, error: photosError } = await supabase
      .from("spot_photos")
      .select("id, display_order, public_url, moderation_state")
      .eq("spot_id", spot.id)
      .in("moderation_state", ["approved", "hidden"])
      .order("display_order", { ascending: true });
    if (photosError) throw photosError;
    spotPhotos = (photos ?? []).map((photo) => ({
      id: photo.id,
      displayOrder: photo.display_order,
      publicUrl: photo.public_url,
      moderationState: photo.moderation_state,
    }));
  }

  return {
    id: data.id,
    kind: data.kind as WithdrawalSummary["kind"],
    state: data.state,
    description: data.description,
    trackingId: data.proposal_tracking_id,
    requesterEmail: data.requester_email,
    decision: data.decision,
    internalNote: data.internal_note,
    createdAt: data.created_at,
    handledAt: data.handled_at,
    spot,
    spotPhotos,
  };
}
