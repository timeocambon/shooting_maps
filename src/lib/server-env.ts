import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.email().optional(),
  BREVO_SENDER_NAME: z.string().min(1).max(120).default("Spotride Toulouse"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://127.0.0.1:3000"),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    BREVO_API_KEY: process.env.BREVO_API_KEY || undefined,
    BREVO_SENDER_EMAIL: process.env.BREVO_SENDER_EMAIL || undefined,
    BREVO_SENDER_NAME: process.env.BREVO_SENDER_NAME || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

