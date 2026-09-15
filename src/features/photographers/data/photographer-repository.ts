import { createClient } from "@supabase/supabase-js";
import {
  socialLinkSchema,
  type PublicPhotographer,
  type PublicPhotographerReview,
  type SocialLink,
} from "@/features/photographers/domain/photographer";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type PublicPhotographerRow = Database["public"]["Functions"]["list_public_photographers"]["Returns"][number];
type PublicPhotographerReviewRow = Database["public"]["Functions"]["list_public_photographer_reviews"]["Returns"][number];

function createPublicSupabaseClient() {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function parseSocials(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => socialLinkSchema.safeParse(item))
    .filter((result): result is { success: true; data: SocialLink } => result.success)
    .map((result) => result.data);
}

function mapRow(row: PublicPhotographerRow): PublicPhotographer {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    bio: row.bio,
    locationLabel: row.location_label,
    socials: parseSocials(row.socials),
    coverImageUrl: row.cover_image_url,
    photoUrls: row.photo_urls ?? [],
    averageRating: row.average_rating,
    reviewCount: row.review_count,
  };
}

export async function getPublishedPhotographers(): Promise<PublicPhotographer[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("list_public_photographers");

  if (error) {
    throw new Error(`Impossible de charger les photographes publiés : ${error.message}`);
  }

  return data.map(mapRow);
}

export async function getPublishedPhotographerBySlug(slug: string): Promise<PublicPhotographer | null> {
  const photographers = await getPublishedPhotographers();
  return photographers.find((photographer) => photographer.slug === slug) ?? null;
}

function mapReviewRow(row: PublicPhotographerReviewRow): PublicPhotographerReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    reviewerName: row.reviewer_name,
    createdAt: row.created_at,
  };
}

export async function getPublishedPhotographerReviews(photographerId: string): Promise<PublicPhotographerReview[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("list_public_photographer_reviews", {
    p_photographer_id: photographerId,
  });

  if (error) {
    throw new Error(`Impossible de charger les avis : ${error.message}`);
  }

  return data.map(mapReviewRow);
}
