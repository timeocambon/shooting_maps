import { describe, expect, it } from "vitest";
import {
  checkPhotoDimensions,
  isAcceptedPhotoBytes,
  isAcceptedPhotoSize,
  PHOTO_RULES,
  uploadMaxDimension,
} from "@/features/proposals/domain/photo-rules";

describe("règle des photos (indépendante de l'orientation)", () => {
  it.each([
    [1600, 900],
    [900, 1600],
    [1000, 1000],
    [600, 1000],
    [1000, 600],
    [20_000, 600],
  ])("accepte %i × %i", (width, height) => {
    expect(checkPhotoDimensions(width, height)).toBe("ok");
    expect(isAcceptedPhotoSize(width, height)).toBe(true);
  });

  it.each([
    [500, 2000],
    [2000, 500],
    [800, 800],
    [999, 600],
    [1000, 599],
  ])("refuse %i × %i (trop petite)", (width, height) => {
    expect(checkPhotoDimensions(width, height)).toBe("too-small");
  });

  it.each([
    [undefined, 1600],
    [1600, null],
    [0, 1600],
    [1600, 0],
    [-900, 1600],
    [1600, -900],
    [Number.NaN, 1600],
    [1600.5, 900],
    ["1600", 900],
  ])("refuse des dimensions absentes, nulles ou négatives (%s × %s)", (width, height) => {
    expect(checkPhotoDimensions(width, height)).toBe("invalid");
  });

  it.each([
    [20_001, 1000],
    [1000, 20_001],
  ])("refuse un côté supérieur à 20 000 px (%i × %i)", (width, height) => {
    expect(checkPhotoDimensions(width, height)).toBe("too-large");
  });

  it("limite le poids à 15 Mo", () => {
    expect(isAcceptedPhotoBytes(PHOTO_RULES.maxBytes)).toBe(true);
    expect(isAcceptedPhotoBytes(PHOTO_RULES.maxBytes + 1)).toBe(false);
    expect(isAcceptedPhotoBytes(0)).toBe(false);
  });

  it("garde au moins 600 px sur le petit côté lors de la réduction navigateur", () => {
    expect(uploadMaxDimension(4000, 3000, 2000)).toBe(2000);
    expect(uploadMaxDimension(3000, 4000, 2000)).toBe(2000);
    expect(uploadMaxDimension(600, 3000, 2000)).toBe(3000);
    expect(uploadMaxDimension(4500, 900, 2000)).toBe(3000);
  });
});
