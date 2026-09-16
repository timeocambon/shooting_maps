import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

// Les pages listées ici portent déjà un « noindex » dans leurs métadonnées.
// Les refuser aussi au niveau du robots.txt évite simplement de faire explorer
// des pages qui ne seront jamais indexées.
const disallowedPaths = [
  "/admin",
  "/mon-espace",
  "/compte",
  "/connexion",
  "/inscription",
  "/proposer",
  "/signaler",
  "/demande-de-retrait",
  "/devenir-photographe",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: disallowedPaths }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
