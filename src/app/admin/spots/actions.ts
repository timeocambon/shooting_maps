"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSessionState } from "@/features/admin/admin-session";
import { spotCategories } from "@/features/spots/domain/spot";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bestTimes = ["morning", "day", "golden_hour", "sunset", "night"] as const;
const addressSchema = z.string().trim().max(240).refine(
  (value) => value.length === 0 || value.length >= 5,
  "Adresse trop courte",
);

const updateSpotSchema = z.object({
  spotId: z.uuid(),
  name: z.string().trim().min(3).max(120),
  address: addressSchema,
  municipality: z.string().trim().min(2).max(120),
  postalCode: z.string().regex(/^\d{5}$/),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  shortDescription: z.string().trim().min(20).max(500),
  categories: z.array(z.enum(spotCategories)).min(1).max(3),
  selectedBestTimes: z.array(z.enum(bestTimes)).min(1).max(3),
  lightOrientation: z.string().trim().max(500),
  accessLevel: z.enum(["easy", "intermediate", "difficult"]),
  surfaceType: z.enum(["asphalt", "gravel", "earth", "mixed"]),
  attendance: z.enum(["quiet", "variable", "busy"]),
  locationStatus: z.enum(["public", "private_with_permission", "to_confirm", "sensitive"]),
  displayPrecision: z.enum(["exact", "approximate", "hidden"]),
  parking: z.string().trim().min(3).max(500),
  walkingApproach: z.string().trim().min(3).max(500),
  warnings: z.string().max(4000),
  markVerified: z.boolean(),
});

const stateSchema = z.object({
  spotId: z.uuid(),
  nextState: z.enum(["published", "hidden", "sensitive", "archived", "review_due"]),
  note: z.string().trim().min(3).max(1000),
});

const deleteSchema = z.object({
  spotId: z.uuid(),
  confirmation: z.string().trim().min(3).max(120),
});

export async function updateSpotAction(spotId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = updateSpotSchema.safeParse({
    spotId,
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    municipality: formData.get("municipality"),
    postalCode: formData.get("postalCode"),
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    shortDescription: formData.get("shortDescription"),
    categories: formData.getAll("categories"),
    selectedBestTimes: formData.getAll("bestTimes"),
    lightOrientation: formData.get("lightOrientation") ?? "",
    accessLevel: formData.get("accessLevel"),
    surfaceType: formData.get("surfaceType"),
    attendance: formData.get("attendance"),
    locationStatus: formData.get("locationStatus"),
    displayPrecision: formData.get("displayPrecision"),
    parking: formData.get("parking"),
    walkingApproach: formData.get("walkingApproach"),
    warnings: formData.get("warnings") ?? "",
    markVerified: formData.get("markVerified") === "on",
  });
  if (!parsed.success) redirect(`/admin/spots/${spotId}?erreur=validation`);

  const warningList = parsed.data.warnings
    .split("\n")
    .map((warning) => warning.trim())
    .filter(Boolean);
  if (warningList.length > 8 || warningList.some((warning) => warning.length > 500)) {
    redirect(`/admin/spots/${spotId}?erreur=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: slug, error } = await supabase.rpc("admin_update_spot", {
    p_spot_id: parsed.data.spotId,
    p_name: parsed.data.name,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_municipality: parsed.data.municipality,
    p_postal_code: parsed.data.postalCode,
    p_short_description: parsed.data.shortDescription,
    p_category_slugs: parsed.data.categories,
    p_best_times: parsed.data.selectedBestTimes,
    p_light_orientation: parsed.data.lightOrientation,
    p_access_level: parsed.data.accessLevel,
    p_parking: parsed.data.parking,
    p_walking_approach: parsed.data.walkingApproach,
    p_surface_type: parsed.data.surfaceType,
    p_attendance: parsed.data.attendance,
    p_location_status: parsed.data.locationStatus,
    p_display_precision: parsed.data.displayPrecision,
    p_warnings: warningList,
    p_mark_verified: parsed.data.markVerified,
  });

  if (error || !slug) redirect(`/admin/spots/${spotId}?erreur=enregistrement`);

  const { error: addressError } = await supabase.rpc("admin_set_spot_address", {
    p_spot_id: parsed.data.spotId,
    p_address: parsed.data.address,
  });
  if (addressError) redirect(`/admin/spots/${spotId}?erreur=enregistrement`);

  revalidatePath("/");
  revalidatePath(`/spots/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/spots");
  redirect(`/admin/spots/${spotId}?maj=contenu`);
}

export async function changeSpotStateAction(spotId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");

  const parsed = stateSchema.safeParse({
    spotId,
    nextState: formData.get("nextState"),
    note: formData.get("note"),
  });
  if (!parsed.success) redirect(`/admin/spots/${spotId}?erreur=etat`);

  const supabase = await createSupabaseServerClient();
  const { data: slug, error } = await supabase.rpc("admin_change_spot_state", {
    p_spot_id: parsed.data.spotId,
    p_next_state: parsed.data.nextState,
    p_note: parsed.data.note,
  });

  if (error || !slug) redirect(`/admin/spots/${spotId}?erreur=etat`);

  revalidatePath("/");
  revalidatePath(`/spots/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/spots");
  if (parsed.data.nextState === "archived") {
    redirect("/admin/spots?retrait=1");
  }
  redirect(`/admin/spots/${spotId}?maj=etat`);
}

export async function deleteSpotAction(spotId: string, formData: FormData) {
  const session = await getAdminSessionState();
  if (session.status !== "authenticated") redirect("/admin");
  if (session.role !== "administrator") {
    redirect(`/admin/spots/${spotId}?erreur=suppression`);
  }

  const parsed = deleteSchema.safeParse({
    spotId,
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect(`/admin/spots/${spotId}?erreur=confirmation`);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_delete_spot", {
    p_spot_id: parsed.data.spotId,
    p_confirmation: parsed.data.confirmation,
  });

  if (error || !data[0]) {
    const reason = error?.message.includes("invalid_confirmation")
      ? "confirmation"
      : "suppression";
    redirect(`/admin/spots/${spotId}?erreur=${reason}`);
  }

  const deleted = data[0];
  if (deleted.original_paths.length) {
    await supabase.storage.from("spot-originals").remove(deleted.original_paths);
  }
  if (deleted.published_paths.length) {
    await supabase.storage.from("spot-published").remove(deleted.published_paths);
  }

  revalidatePath("/");
  revalidatePath(`/spots/${deleted.deleted_slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/spots");
  redirect("/admin/spots?suppression=1");
}
