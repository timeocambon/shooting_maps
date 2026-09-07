import { z } from "zod";
import { reportStateLabels } from "@/features/reports/domain/report";

export const withdrawalKinds = ["photo", "data"] as const;

export type WithdrawalKind = (typeof withdrawalKinds)[number];

export const withdrawalKindLabels: Record<WithdrawalKind, string> = {
  photo: "Retirer une ou plusieurs photos",
  data: "Supprimer mes données personnelles",
};

export const withdrawalKindHints: Record<WithdrawalKind, string> = {
  photo: "Une photo déjà publiée, ou envoyée dans une proposition, vous concerne.",
  data: "Vous souhaitez que les informations que vous avez transmises soient supprimées.",
};

// L'état réutilise le même automate que les signalements (report_state en base).
export const withdrawalStateLabels = reportStateLabels;

export const withdrawalRequestSchema = z.object({
  kind: z.enum(withdrawalKinds),
  spotSlug: z.string().trim().max(160).optional().default(""),
  trackingId: z.string().trim().max(40).optional().default(""),
  description: z.string().trim().min(10).max(2000),
  email: z.email().max(320),
  website: z.string().max(200).default(""),
});

export type PublicWithdrawalRequestInput = z.infer<typeof withdrawalRequestSchema>;
