import { z } from "zod";

export const spotCategories = [
  "urban",
  "industrial",
  "architecture",
  "nature",
  "panorama",
  "graffiti",
] as const;

export type SpotCategory = (typeof spotCategories)[number];

export const categoryLabels: Record<SpotCategory, string> = {
  urban: "Urbain",
  industrial: "Industriel",
  architecture: "Architecture",
  nature: "Nature",
  panorama: "Panorama",
  graffiti: "Graffiti",
};

export const publicSpotSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  municipality: z.string().min(1),
  postalCode: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  displayPrecision: z.enum(["exact", "approximate"]),
  shortDescription: z.string().min(1),
  categories: z.array(z.enum(spotCategories)).min(1),
  bestTimes: z.array(
    z.enum(["morning", "day", "golden_hour", "sunset", "night"]),
  ),
  accessLevel: z.enum(["easy", "intermediate", "difficult"]),
  surfaceType: z.enum(["asphalt", "gravel", "earth", "mixed"]),
  attendance: z.enum(["quiet", "variable", "busy"]),
  locationStatus: z.enum([
    "public",
    "private_with_permission",
    "to_confirm",
    "sensitive",
  ]),
  warnings: z.array(z.string()),
  parking: z.string(),
  walkingApproach: z.string(),
  lightOrientation: z.string().nullable(),
  lastVerifiedAt: z.string().date(),
  coverImageUrl: z.string().url().nullable(),
  photoUrls: z.array(z.string().url()),
  isDemo: z.boolean().default(false),
});

export type PublicSpot = z.infer<typeof publicSpotSchema>;

export const bestTimeLabels: Record<PublicSpot["bestTimes"][number], string> = {
  morning: "Matin",
  day: "Journée",
  golden_hour: "Golden hour",
  sunset: "Coucher de soleil",
  night: "Nuit",
};

export const accessLabels: Record<PublicSpot["accessLevel"], string> = {
  easy: "Facile",
  intermediate: "Intermédiaire",
  difficult: "Difficile",
};

export const surfaceLabels: Record<PublicSpot["surfaceType"], string> = {
  asphalt: "Bitume",
  gravel: "Gravier",
  earth: "Terre",
  mixed: "Mixte",
};

export const attendanceLabels: Record<PublicSpot["attendance"], string> = {
  quiet: "Calme",
  variable: "Variable",
  busy: "Fréquenté",
};
