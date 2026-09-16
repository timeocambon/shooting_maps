import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  images: {
    // Sans cette autorisation, next/image refuse les URL du stockage Supabase :
    // c'est la raison pour laquelle tout le site utilisait « unoptimized »,
    // donc servait les originaux en pleine résolution.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" }],
    // Les chemins contiennent un identifiant unique : une photo publiée ne
    // change jamais. Un cache long évite de refacturer une transformation à
    // chaque expiration (le quota Vercel se compte en transformations).
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

// Sans SENTRY_AUTH_TOKEN (non défini en local), l'envoi des source maps est
// simplement ignoré : le wrapping reste inoffensif tant que les variables
// Sentry ne sont pas renseignées.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  disableLogger: true,
  widenClientFileUpload: true,
  telemetry: false,
});
