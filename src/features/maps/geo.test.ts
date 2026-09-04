import { describe, expect, it } from "vitest";
import { distanceKm } from "@/features/maps/geo";

describe("distanceKm", () => {
  it("renvoie zéro pour deux positions identiques", () => {
    const toulouse = { latitude: 43.6045, longitude: 1.4442 };
    expect(distanceKm(toulouse, toulouse)).toBeCloseTo(0, 3);
  });

  it("calcule une distance cohérente entre Toulouse et Paris", () => {
    const toulouse = { latitude: 43.6045, longitude: 1.4442 };
    const paris = { latitude: 48.8566, longitude: 2.3522 };

    const distance = distanceKm(toulouse, paris);

    expect(distance).toBeGreaterThan(570);
    expect(distance).toBeLessThan(610);
  });

  it("reste symétrique quel que soit l'ordre des points", () => {
    const a = { latitude: 43.6, longitude: 1.44 };
    const b = { latitude: 43.55, longitude: 1.48 };

    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
});
