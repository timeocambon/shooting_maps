/**
 * Règle des photos d'une proposition, identique à l'application mobile et à
 * la fonction `attach_proposal_photo`, indépendante de l'orientation :
 * - grand côté ≥ 1000 px, petit côté ≥ 600 px ;
 * - 20 000 px au plus par côté ;
 * - 15 Mo au plus.
 * Une photo verticale (900 × 1600) est acceptée comme une horizontale
 * (1600 × 900). Aucun recadrage n'est imposé.
 */
export const PHOTO_RULES = {
  minLongSide: 1000,
  minShortSide: 600,
  maxSide: 20_000,
  maxBytes: 15 * 1024 * 1024,
} as const;

export const PHOTO_SIZE_RULE_TEXT =
  "La photo doit mesurer au moins 1000 px sur son grand côté et 600 px sur son petit côté.";

export type PhotoDimensionsCheck = "ok" | "invalid" | "too-small" | "too-large";

const isDimension = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

/** Dimensions absentes, nulles, négatives ou non entières → `invalid`. */
export function checkPhotoDimensions(width: unknown, height: unknown): PhotoDimensionsCheck {
  if (!isDimension(width) || !isDimension(height)) return "invalid";
  if (width > PHOTO_RULES.maxSide || height > PHOTO_RULES.maxSide) return "too-large";
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  return longSide >= PHOTO_RULES.minLongSide && shortSide >= PHOTO_RULES.minShortSide
    ? "ok"
    : "too-small";
}

export const isAcceptedPhotoSize = (width: unknown, height: unknown) =>
  checkPhotoDimensions(width, height) === "ok";

/** Poids accepté : 1 octet à 15 Mo. */
export const isAcceptedPhotoBytes = (bytes: unknown) =>
  typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0 && bytes <= PHOTO_RULES.maxBytes;

/**
 * Plus grand côté conservé lors de la réduction dans le navigateur : la
 * valeur habituelle, relevée si nécessaire pour qu'une photo très allongée
 * (panorama vertical ou horizontal) garde au moins 600 px sur son petit côté.
 */
export function uploadMaxDimension(width: number, height: number, usual: number): number {
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  if (shortSide <= 0) return usual;
  return Math.max(usual, Math.ceil((PHOTO_RULES.minShortSide * longSide) / shortSide));
}
