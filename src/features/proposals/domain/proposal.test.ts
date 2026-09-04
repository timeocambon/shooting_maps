import { describe, expect, it } from "vitest";
import { proposalPayloadSchema } from "@/features/proposals/domain/proposal";

const validPayload = {
  address: "12 rue des Arts 31000 Toulouse",
  latitude: 43.61,
  longitude: 1.45,
  municipality: "Toulouse",
  postalCode: "31000",
  displayPrecision: "exact",
  accessWithoutTrespass: true,
  name: "Quai de test",
  categories: ["urban"],
  shortDescription: "Un décor suffisamment détaillé pour être examiné.",
  bestTimes: ["golden_hour"],
  visualFeatures: "Lumière latérale.",
  accessLevel: "easy",
  parking: "À proximité.",
  walkingApproach: "Deux minutes à pied.",
  surfaceType: "asphalt",
  traffic: "Modérée en semaine.",
  attendance: "variable",
  risks: "Ne pas gêner la circulation ni les riverains.",
  locationStatus: "to_confirm",
} as const;

describe("proposalPayloadSchema", () => {
  it("accepte une proposition complète", () => {
    expect(proposalPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("refuse une contribution qui implique une intrusion", () => {
    expect(
      proposalPayloadSchema.safeParse({ ...validPayload, accessWithoutTrespass: false }).success,
    ).toBe(false);
  });
});
