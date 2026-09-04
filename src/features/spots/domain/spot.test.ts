import { describe, expect, it } from "vitest";
import { demoSpots } from "@/features/spots/data/demo-spots";
import { publicSpotSchema } from "@/features/spots/domain/spot";

describe("publicSpotSchema", () => {
  it("valide toutes les fiches de démonstration", () => {
    expect(() => demoSpots.forEach((spot) => publicSpotSchema.parse(spot))).not.toThrow();
  });

  it("refuse des coordonnées hors limites", () => {
    expect(() =>
      publicSpotSchema.parse({ ...demoSpots[0], latitude: 120 }),
    ).toThrow();
  });
});
