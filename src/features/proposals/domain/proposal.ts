import { z } from "zod";
import { spotCategories } from "@/features/spots/domain/spot";

export const proposalPayloadSchema = z
  .object({
    address: z.string().trim().min(5).max(180),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    municipality: z.string().trim().min(2).max(120),
    postalCode: z.string().regex(/^\d{5}$/),
    displayPrecision: z.enum(["exact", "approximate"]),
    accessWithoutTrespass: z.literal(true),
    name: z.string().trim().min(3).max(120),
    categories: z.array(z.enum(spotCategories)).min(1).max(3),
    shortDescription: z.string().trim().min(20).max(500),
    bestTimes: z
      .array(z.enum(["morning", "day", "golden_hour", "sunset", "night"]))
      .min(1)
      .max(3),
    visualFeatures: z.string().trim().max(500),
    accessLevel: z.enum(["easy", "intermediate", "difficult"]),
    parking: z.string().trim().min(3).max(500),
    walkingApproach: z.string().trim().min(3).max(500),
    surfaceType: z.enum(["asphalt", "gravel", "earth", "mixed"]),
    traffic: z.string().trim().min(3).max(500),
    attendance: z.enum(["quiet", "variable", "busy"]),
    risks: z.string().trim().min(10).max(2000),
    locationStatus: z.enum([
      "public",
      "private_with_permission",
      "to_confirm",
      "sensitive",
    ]),
  })
  .strict();

export const proposalSubmissionSchema = z.object({
  payload: proposalPayloadSchema,
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  pseudonym: z.string().trim().max(80),
  photoCredit: z.string().trim().max(120),
  rightsDeclared: z.literal(true),
  peopleConfirmed: z.literal(true),
  charterAccepted: z.literal(true),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  website: z.string().max(0),
});

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

export const proposalStateLabels = {
  draft: "Brouillon",
  email_pending: "E-mail à confirmer",
  submitted: "À vérifier",
  changes_requested: "Compléments demandés",
  approved: "Publiée",
  rejected: "Refusée",
  duplicate: "Doublon",
  withdrawn: "Retirée",
} as const;
