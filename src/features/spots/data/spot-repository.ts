import { createClient } from "@supabase/supabase-js";
import { demoSpots } from "@/features/spots/data/demo-spots";
import {
  publicSpotSchema,
  type PublicSpot,
} from "@/features/spots/domain/spot";
import { getPublicEnv, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

type PublicSpotRow = Database["public"]["Functions"]["list_public_spots"]["Returns"][number];

export type UnavailableSpot = {
  name: string;
  state: string;
};

function createPublicSupabaseClient() {
  const env = getPublicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function mapRow(row: PublicSpotRow): PublicSpot {
  return publicSpotSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    municipality: row.municipality,
    postalCode: row.postal_code,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    displayPrecision: row.display_precision,
    shortDescription: row.short_description,
    categories: row.categories,
    bestTimes: row.best_times,
    accessLevel: row.access_level,
    surfaceType: row.surface_type,
    attendance: row.attendance,
    locationStatus: row.location_status,
    warnings: row.warnings,
    parking: row.parking,
    walkingApproach: row.walking_approach,
    lightOrientation: row.light_orientation,
    lastVerifiedAt: row.last_verified_at,
    coverImageUrl: row.cover_image_url,
    photoUrls: row.photo_urls ?? [],
    isDemo: false,
  });
}

export async function getPublishedSpots(): Promise<PublicSpot[]> {
  if (!isSupabaseConfigured()) {
    return demoSpots;
  }

  const supabase = createPublicSupabaseClient();

  const { data, error } = await supabase.rpc("list_public_spots");

  if (error) {
    throw new Error(`Impossible de charger les spots publiés : ${error.message}`);
  }

  return data.map(mapRow);
}

export async function getPublishedSpotBySlug(
  slug: string,
): Promise<PublicSpot | null> {
  const spots = await getPublishedSpots();
  return spots.find((spot) => spot.slug === slug) ?? null;
}

export async function getPublicSpotUnavailability(
  slug: string,
): Promise<UnavailableSpot | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_public_spot_unavailability", {
    p_slug: slug,
  });

  if (error) {
    throw new Error(`Impossible de vérifier la disponibilité de la fiche : ${error.message}`);
  }

  const row = data[0];
  return row ? { name: row.name, state: row.publication_state } : null;
}
