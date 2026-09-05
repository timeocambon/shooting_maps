import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
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
