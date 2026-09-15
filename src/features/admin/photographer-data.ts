import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { socialLinkSchema, type SocialLink } from "@/features/photographers/domain/photographer";

export type PhotographerSummary = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  contactEmail: string;
  publicationState: string;
  createdAt: string;
  photoCount: number;
};

export type PhotographerReview = {
  id: string;
  name: string;
  tagline: string;
  bio: string;
  locationLabel: string | null;
  socials: SocialLink[];
  contactEmail: string;
  publicationState: string;
  createdAt: string;
  photos: Array<{ id: string; displayOrder: number; publicUrl: string; moderationState: string }>;
};

export type PendingReviewSummary = {
  id: string;
  photographerId: string;
  photographerName: string;
  photographerSlug: string;
  rating: number;
  comment: string;
  reviewerName: string | null;
  createdAt: string;
};

function parseSocials(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => socialLinkSchema.safeParse(item))
    .filter((result): result is { success: true; data: SocialLink } => result.success)
    .map((result) => result.data);
}

export async function getPhotographerQueue(): Promise<PhotographerSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("photographers")
    .select("id, slug, name, tagline, contact_email, publication_state, created_at, photographer_photos(count)")
    .eq("publication_state", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    contactEmail: row.contact_email,
    publicationState: row.publication_state,
    createdAt: row.created_at,
    photoCount: row.photographer_photos[0]?.count ?? 0,
  }));
}

export async function getPhotographerReview(id: string): Promise<PhotographerReview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("photographers")
    .select(
      "id, name, tagline, bio, location_label, socials, contact_email, publication_state, created_at, photographer_photos(id, display_order, public_url, moderation_state)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    tagline: data.tagline,
    bio: data.bio,
    locationLabel: data.location_label,
    socials: parseSocials(data.socials),
    contactEmail: data.contact_email,
    publicationState: data.publication_state,
    createdAt: data.created_at,
    photos: data.photographer_photos
      .slice()
      .sort((left, right) => left.display_order - right.display_order)
      .map((photo) => ({
        id: photo.id,
        displayOrder: photo.display_order,
        publicUrl: photo.public_url,
        moderationState: photo.moderation_state,
      })),
  };
}

export async function getPendingReviewQueue(): Promise<PendingReviewSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("photographer_reviews")
    .select("id, photographer_id, rating, comment, reviewer_name, created_at, photographers(name, slug)")
    .eq("moderation_state", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const photographer = Array.isArray(row.photographers) ? row.photographers[0] : row.photographers;
    return {
      id: row.id,
      photographerId: row.photographer_id,
      photographerName: photographer?.name ?? "Photographe inconnu",
      photographerSlug: photographer?.slug ?? "",
      rating: row.rating,
      comment: row.comment,
      reviewerName: row.reviewer_name,
      createdAt: row.created_at,
    };
  });
}
