"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const addressSchema = z.string().trim().max(240).refine(
  (value) => value.length === 0 || value.length >= 5,
  "Adresse trop courte",
);

const spotSchema = z.object({
  name: z.string().trim().min(3).max(120),
  address: addressSchema,
  municipality: z.string().trim().min(2).max(120),
  postalCode: z.string().regex(/^\d{5}$/),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  shortDescription: z.string().trim().min(20).max(500),
  category: z.enum(["urban", "industrial", "architecture", "nature", "panorama", "graffiti"]),
  bestTime: z.enum(["morning", "day", "golden_hour", "sunset", "night"]),
  accessLevel: z.enum(["easy", "intermediate", "difficult"]),
  surfaceType: z.enum(["asphalt", "gravel", "earth", "mixed"]),
  attendance: z.enum(["quiet", "variable", "busy"]),
  locationStatus: z.enum(["public", "private_with_permission", "to_confirm", "sensitive"]),
  displayPrecision: z.enum(["exact", "approximate"]),
  parking: z.string().trim().min(3).max(500),
  walkingApproach: z.string().trim().min(3).max(500),
  warnings: z.string().max(2000),
});

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

export async function signInAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/admin/connexion?erreur=configuration");
  }

  const result = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    redirect("/admin/connexion?erreur=identifiants");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    redirect("/admin/connexion?erreur=connexion");
  }

  redirect("/admin/securite");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}

export async function createSpotAction(formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const result = spotSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    municipality: formData.get("municipality"),
    postalCode: formData.get("postalCode"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    shortDescription: formData.get("shortDescription"),
    category: formData.get("category"),
    bestTime: formData.get("bestTime"),
    accessLevel: formData.get("accessLevel"),
    surfaceType: formData.get("surfaceType"),
    attendance: formData.get("attendance"),
    locationStatus: formData.get("locationStatus"),
    displayPrecision: formData.get("displayPrecision"),
    parking: formData.get("parking"),
    walkingApproach: formData.get("walkingApproach"),
    warnings: formData.get("warnings") ?? "",
  });

  if (!result.success) redirect("/admin/spots/nouveau?erreur=validation");

  const slug = slugify(result.data.name);
  if (!slug) redirect("/admin/spots/nouveau?erreur=validation");

  const warnings = result.data.warnings
    .split("\n")
    .map((warning) => warning.trim())
    .filter(Boolean);
  const supabase = await createSupabaseServerClient();
  const { data: spotId, error } = await supabase.rpc("admin_create_spot", {
    p_name: result.data.name,
    p_slug: slug,
    p_latitude: result.data.latitude,
    p_longitude: result.data.longitude,
    p_municipality: result.data.municipality,
    p_postal_code: result.data.postalCode,
    p_short_description: result.data.shortDescription,
    p_category_slug: result.data.category,
    p_best_time: result.data.bestTime,
    p_access_level: result.data.accessLevel,
    p_parking: result.data.parking,
    p_walking_approach: result.data.walkingApproach,
    p_surface_type: result.data.surfaceType,
    p_attendance: result.data.attendance,
    p_location_status: result.data.locationStatus,
    p_display_precision: result.data.displayPrecision,
    p_warnings: warnings,
  });

  if (error) {
    const reason = error.message.includes("spots_slug_key") ? "slug" : "enregistrement";
    redirect(`/admin/spots/nouveau?erreur=${reason}`);
  }

  if (!spotId) redirect("/admin/spots/nouveau?erreur=enregistrement");
  const { error: addressError } = await supabase.rpc("admin_set_spot_address", {
    p_spot_id: spotId,
    p_address: result.data.address,
  });
  if (addressError) redirect("/admin/spots/nouveau?erreur=enregistrement");

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/spots");
  revalidatePath(`/spots/${slug}`);
  redirect("/admin/spots?creation=1");
}
