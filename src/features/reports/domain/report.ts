import { z } from "zod";

export const reportReasons = [
  "access_forbidden",
  "immediate_danger",
  "incorrect_information",
  "image_or_identifiable_person",
  "private_property_or_nuisance",
  "duplicate",
  "other",
] as const;

export type ReportReason = (typeof reportReasons)[number];

export const reportReasonLabels: Record<ReportReason, string> = {
  access_forbidden: "Accès désormais interdit",
  immediate_danger: "Danger ou problème de sécurité",
  incorrect_information: "Information incorrecte",
  image_or_identifiable_person: "Photo ou personne identifiable",
  private_property_or_nuisance: "Propriété privée ou nuisance",
  duplicate: "Fiche en doublon",
  other: "Autre motif",
};

export const reportStateLabels = {
  open: "Ouvert",
  in_review: "En cours",
  resolved: "Résolu",
  dismissed: "Classé sans suite",
} as const;

export const reportSchema = z
  .object({
    spotId: z.uuid(),
    reason: z.enum(reportReasons),
    comment: z.string().trim().min(10).max(2000),
    email: z.union([z.literal(""), z.email().max(320)]),
    website: z.string().max(200).default(""),
  })
  .superRefine((value, context) => {
    if (
      ["image_or_identifiable_person", "private_property_or_nuisance"].includes(
        value.reason,
      ) &&
      !value.email
    ) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Une adresse e-mail est nécessaire pour ce motif.",
      });
    }
  });

export type PublicReportInput = z.infer<typeof reportSchema>;

export function reportNeedsContact(reason: ReportReason): boolean {
  return [
    "image_or_identifiable_person",
    "private_property_or_nuisance",
  ].includes(reason);
}

/** Signalements encore à traiter (file de modération). */
export const OPEN_REPORT_STATES = ["open", "in_review"] as const;

/** États où la fiche du spot reste consultable publiquement. */
export const PUBLIC_SPOT_STATES = ["published", "sensitive", "review_due"] as const;

export function isPublicSpotState(state: string): boolean {
  return (PUBLIC_SPOT_STATES as readonly string[]).includes(state);
}

export const spotPublicationStateLabels: Record<string, string> = {
  published: "Publié",
  hidden: "Masqué",
  sensitive: "Sensible",
  archived: "Archivé",
  review_due: "À revérifier",
};

/** Ordre de la file : priorité haute d'abord, puis les plus anciens. */
export function compareReportsForQueue(
  left: { priority: string; createdAt: string },
  right: { priority: string; createdAt: string },
): number {
  const rank = (priority: string) => (priority === "high" ? 0 : 1);
  return (
    rank(left.priority) - rank(right.priority) ||
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );
}
