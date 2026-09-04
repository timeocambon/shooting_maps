import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SpotState = Database["public"]["Enums"]["spot_state"];

export type CatalogSpotSummary = {
  id: string;
  slug: string;
  name: string;
  municipality: string;
  postalCode: string;
  publicationState: SpotState;
  displayPrecision: string;
  lastVerifiedAt: string;
  updatedAt: string;
  categories: string[];
  openReportCount: number;
};

export type CatalogSpot = {
  id: string;
  slug: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  municipality: string;
  postalCode: string;
  shortDescription: string;
  categories: string[];
  bestTimes: string[];
  lightOrientation: string | null;
  accessLevel: string;
  parking: string;
  walkingApproach: string;
  surfaceType: string;
  attendance: string;
  locationStatus: string;
  displayPrecision: string;
  warnings: string[];
  publicationState: SpotState;
  lastVerifiedAt: string;
  updatedAt: string;
};

export async function getCatalogSpots(): Promise<CatalogSpotSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { error: refreshError } = await supabase.rpc("admin_refresh_review_due_spots");
  if (refreshError) throw refreshError;

  const { data, error } = await supabase.rpc("admin_list_spots");
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    municipality: row.municipality,
    postalCode: row.postal_code,
    publicationState: row.publication_state as SpotState,
    displayPrecision: row.display_precision,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
    categories: row.categories,
    openReportCount: Number(row.open_report_count),
  }));
}

export async function getCatalogSpot(id: string): Promise<CatalogSpot | null> {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { data: addressRow, error: addressError }] = await Promise.all([
    supabase.rpc("admin_get_spot", { p_spot_id: id }),
    supabase.from("spots").select("address").eq("id", id).maybeSingle(),
  ]);
  if (error) throw error;
  if (addressError) throw addressError;

  const row = data[0];
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: addressRow?.address ?? "",
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    municipality: row.municipality,
    postalCode: row.postal_code,
    shortDescription: row.short_description,
    categories: row.categories,
    bestTimes: row.best_times,
    lightOrientation: row.light_orientation,
    accessLevel: row.access_level,
    parking: row.parking,
    walkingApproach: row.walking_approach,
    surfaceType: row.surface_type,
    attendance: row.attendance,
    locationStatus: row.location_status,
    displayPrecision: row.display_precision,
    warnings: row.warnings,
    publicationState: row.publication_state as SpotState,
    lastVerifiedAt: row.last_verified_at,
    updatedAt: row.updated_at,
  };
}
