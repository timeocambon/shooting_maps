import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AccountState =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      userId: string;
      email: string;
      displayName: string | null;
      isAdmin: boolean;
    };

export async function getAccountState(): Promise<AccountState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return { status: "anonymous" };

  const [{ data: profile }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("am_i_admin"),
  ]);

  return {
    status: "authenticated",
    userId: user.id,
    email: user.email,
    displayName: profile?.display_name ?? null,
    isAdmin: Boolean(isAdmin),
  };
}

export type OwnedPhotographer = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  bio: string;
  locationLabel: string | null;
  socials: unknown;
  publicationState: string;
  photos: Array<{ id: string; public_url: string; display_order: number; moderation_state: string }>;
};

export async function getMyPhotographerProfile(): Promise<OwnedPhotographer | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_my_photographer_profile");
  if (error || !data?.length) return null;

  const row = data[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    bio: row.bio,
    locationLabel: row.location_label,
    socials: row.socials,
    publicationState: row.publication_state,
    photos: Array.isArray(row.photos)
      ? (row.photos as OwnedPhotographer["photos"])
      : [],
  };
}
