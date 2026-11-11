// @vitest-environment node

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processProposalImage } from "@/features/proposals/server/image-processing";

describe("processProposalImage", () => {
  it("détecte le contenu réel et crée une variante WebP sans agrandissement", async () => {
    const source = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: "#c77750" },
    }).jpeg().toBuffer();

    const result = await processProposalImage(source);
    const metadata = await sharp(result.processedBytes).metadata();

    expect(result.detectedMimeType).toBe("image/jpeg");
    expect(result.originalExtension).toBe("jpg");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(800);
    expect(metadata.exif).toBeUndefined();
  });

  const image = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: "#5a6b7c" } }).jpeg().toBuffer();

  it.each([
    [1600, 900],
    [900, 1600],
    [1000, 1000],
    [600, 1000],
    [1000, 600],
  ])("accepte %i × %i sans recadrage ni agrandissement", async (width, height) => {
    const result = await processProposalImage(await image(width, height));
    const metadata = await sharp(result.processedBytes).metadata();
    expect(result.width).toBe(width);
    expect(result.height).toBe(height);
    expect([metadata.width, metadata.height]).toEqual([width, height]);
  });

  it.each([
    [500, 2000],
    [2000, 500],
    [800, 800],
    [999, 600],
    [1000, 599],
  ])("refuse %i × %i", async (width, height) => {
    await expect(processProposalImage(await image(width, height))).rejects.toThrow("image_too_small");
  });

  it("garde une photo verticale verticale : même réduction que l'horizontale, ratio conservé", async () => {
    const portrait = await processProposalImage(await image(2400, 3600));
    const landscape = await processProposalImage(await image(3600, 2400));
    const p = await sharp(portrait.processedBytes).metadata();
    const l = await sharp(landscape.processedBytes).metadata();
    expect([p.width, p.height]).toEqual([1200, 1800]);
    expect([l.width, l.height]).toEqual([1800, 1200]);
  });

  it("applique l'orientation EXIF et retire les métadonnées de la version publiée", async () => {
    // Pixels stockés en paysage 1600 × 900, EXIF « rotation 90° » : photo verticale.
    const source = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#123456" } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const result = await processProposalImage(source);
    const metadata = await sharp(result.processedBytes).metadata();
    expect([metadata.width, metadata.height]).toEqual([900, 1600]);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
  });

  it("refuse un fichier de plus de 15 Mo ou vide", async () => {
    await expect(processProposalImage(Buffer.alloc(15 * 1024 * 1024 + 1))).rejects.toThrow("invalid_file_size");
    await expect(processProposalImage(Buffer.alloc(0))).rejects.toThrow("invalid_file_size");
  });

  it("refuse un fichier trop petit même si son format est valide", async () => {
    const source = await sharp({
      create: { width: 640, height: 480, channels: 3, background: "#385345" },
    }).png().toBuffer();

    await expect(processProposalImage(source)).rejects.toThrow("image_too_small");
  });

  it("récupère un JPEG mobile décodable auquel il manque le marqueur de fin", async () => {
    const source = await image(1200, 800);
    const withoutEndMarker = source.subarray(0, source.length - 2);

    const result = await processProposalImage(withoutEndMarker);
    const metadata = await sharp(result.processedBytes).metadata();

    expect(result.detectedMimeType).toBe("image/jpeg");
    expect([result.width, result.height]).toEqual([1200, 800]);
    expect([metadata.width, metadata.height]).toEqual([1200, 800]);
    expect(metadata.format).toBe("webp");
  });

  it("continue de refuser un contenu réellement illisible", async () => {
    await expect(processProposalImage(Buffer.from("pas une image"))).rejects.toThrow(
      "invalid_image_content",
    );
  });
});
