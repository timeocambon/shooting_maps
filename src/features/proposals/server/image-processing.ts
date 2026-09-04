import sharp, { type Metadata } from "sharp";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const allowedFormats = new Set(["jpeg", "png", "webp"]);

const mimeTypes: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type ProcessedProposalImage = {
  originalBytes: Buffer;
  processedBytes: Buffer;
  detectedMimeType: string;
  originalExtension: "jpg" | "png" | "webp";
  width: number;
  height: number;
  byteSize: number;
};

export async function processProposalImage(
  bytes: Buffer,
): Promise<ProcessedProposalImage> {
  if (bytes.length < 1 || bytes.length > MAX_FILE_SIZE) {
    throw new Error("invalid_file_size");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: "warning",
      limitInputPixels: MAX_PIXELS,
    }).metadata();
  } catch {
    throw new Error("invalid_image_content");
  }

  if (
    !metadata.format ||
    !allowedFormats.has(metadata.format) ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error("unsupported_image");
  }

  if (metadata.width < 1000 || metadata.height < 600) {
    throw new Error("image_too_small");
  }

  const processedBytes = await sharp(bytes, {
    failOn: "warning",
    limitInputPixels: MAX_PIXELS,
  })
    .rotate()
    .resize({ width: 1800, height: 1350, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();

  return {
    originalBytes: bytes,
    processedBytes,
    detectedMimeType: mimeTypes[metadata.format],
    originalExtension:
      metadata.format === "jpeg" ? "jpg" : metadata.format === "png" ? "png" : "webp",
    width: metadata.width,
    height: metadata.height,
    byteSize: bytes.length,
  };
}
