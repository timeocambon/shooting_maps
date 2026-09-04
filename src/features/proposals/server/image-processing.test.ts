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

  it("refuse un fichier trop petit même si son format est valide", async () => {
    const source = await sharp({
      create: { width: 640, height: 480, channels: 3, background: "#385345" },
    }).png().toBuffer();

    await expect(processProposalImage(source)).rejects.toThrow("image_too_small");
  });
});
