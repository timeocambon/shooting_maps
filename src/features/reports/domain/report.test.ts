import { describe, expect, it } from "vitest";
import { reportNeedsContact, reportSchema } from "@/features/reports/domain/report";

const validReport = {
  spotId: "11111111-1111-4111-8111-111111111111",
  reason: "incorrect_information",
  comment: "Les horaires indiqués ne sont plus à jour.",
  email: "",
  website: "",
};

describe("reportSchema", () => {
  it("accepte un signalement général sans e-mail", () => {
    expect(reportSchema.safeParse(validReport).success).toBe(true);
  });

  it("demande un contact pour une demande liée à une personne", () => {
    const result = reportSchema.safeParse({
      ...validReport,
      reason: "image_or_identifiable_person",
    });
    expect(result.success).toBe(false);
    expect(reportNeedsContact("image_or_identifiable_person")).toBe(true);
  });

  it("refuse un commentaire trop court", () => {
    expect(reportSchema.safeParse({ ...validReport, comment: "Court" }).success).toBe(false);
  });
});
