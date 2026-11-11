import sharp, { type Metadata } from "sharp";
import { checkPhotoDimensions, PHOTO_RULES } from "@/features/proposals/domain/photo-rules";

const MAX_FILE_SIZE = PHOTO_RULES.maxBytes;
/** Grand côté de la version publiée (verticale ou horizontale, jamais agrandie). */
const PUBLISHED_LONG_SIDE = 1800;
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

  // Grand côté ≥ 1000 px et petit côté ≥ 600 px, quelle que soit
  // l'orientation (la rotation EXIF n'échange que largeur et hauteur).
  const dimensions = checkPhotoDimensions(metadata.width, metadata.height);
  if (dimensions === "too-large") throw new Error("image_too_large");
  if (dimensions !== "ok") throw new Error("image_too_small");

  const processedBytes = await sharp(bytes, {
    failOn: "warning",
    limitInputPixels: MAX_PIXELS,
  })
    // Orientation EXIF appliquée, ratio conservé, aucun agrandissement ;
    // boîte carrée : une photo verticale n'est pas réduite plus qu'une horizontale.
    .rotate()
    .resize({
      width: PUBLISHED_LONG_SIDE,
      height: PUBLISHED_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
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
