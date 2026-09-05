import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_MAP_STYLE_URL: z.union([z.string().url(), z.literal("osm-raster")]).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().min(1).optional(),
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    NEXT_PUBLIC_MAP_STYLE_URL:
      process.env.NEXT_PUBLIC_MAP_STYLE_URL || undefined,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN:
      process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || undefined,
  });
}

export function isSupabaseConfigured(): boolean {
  const env = getPublicEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function getMapStyleUrl(): string {
  return (
    getPublicEnv().NEXT_PUBLIC_MAP_STYLE_URL ??
    "osm-raster"
  );
}

export function getPlausibleDomain(): string | null {
  return getPublicEnv().NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? null;
}
