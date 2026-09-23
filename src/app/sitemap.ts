import type { MetadataRoute } from "next";
import { getPublishedSpots } from "@/features/spots/data/spot-repository";
import { getPublishedPhotographers } from "@/features/photographers/data/photographer-repository";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

// Le sitemap est régénéré au plus une fois par heure : inutile d'interroger la
// base à chaque passage d'un robot.
export const revalidate = 3600;

// Seules les pages réellement indexables figurent ici. Tout ce qui porte un
// « noindex » (administration, espace personnel, formulaires) en est exclu.
const staticPaths = [
  "",
  "/comment-ca-marche",
  "/photographes",
  "/a-propos",
  "/charte",
  "/confidentialite",
  "/mentions-legales",
];

// Les spots de démonstration ne doivent pas être proposés aux moteurs. À
// retirer le jour où le jeu de démonstration disparaît de la base.
function isDemoSlug(slug: string): boolean {
  return slug.endsWith("-demo") || slug.endsWith("-demonstration");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${siteUrl}${path}`,
    changeFrequency: path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));

  // Une base injoignable ne doit pas faire échouer le build : dans ce cas le
  // sitemap se limite aux pages statiques plutôt que de disparaître.
  try {
    const spots = await getPublishedSpots();
    for (const spot of spots) {
      if (spot.isDemo || isDemoSlug(spot.slug)) continue;
      entries.push({
        url: `${siteUrl}/spots/${spot.slug}`,
        lastModified: new Date(spot.lastVerifiedAt),
        changeFrequency: "monthly",
        priority: 0.8,
      });
    }
  } catch (error) {
    console.error("[sitemap] spots indisponibles", error);
  }

  try {
    const photographers = await getPublishedPhotographers();
    for (const photographer of photographers) {
      entries.push({
        url: `${siteUrl}/photographes/${photographer.slug}`,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (error) {
    console.error("[sitemap] photographes indisponibles", error);
  }

  return entries;
}
