/**
 * Réduction des photos dans le navigateur, avant l'envoi vers le stockage.
 *
 * Un appareil photo ou un téléphone récent produit des fichiers de 4 à 6 Mo en
 * 4000 × 3000. Or la plus grande taille réellement affichée sur le site est la
 * vue plein écran de la galerie. Envoyer l'original coûte du stockage, de la
 * bande passante à chaque affichage, et n'apporte rien de visible.
 *
 * Le redimensionnement se fait ici plutôt que côté serveur : c'est gratuit,
 * instantané, et ça évite de faire transiter plusieurs mégaoctets par une
 * fonction serverless.
 */

export const MAX_UPLOAD_DIMENSION = 2000;
export const UPLOAD_QUALITY = 0.82;

export type ProcessedImage = {
  file: File;
  originalBytes: number;
  bytes: number;
};

function targetSize(width: number, height: number, maxDimension: number) {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const ratio = maxDimension / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * Renvoie une version réduite et convertie en WebP. En cas d'échec (navigateur
 * trop ancien, fichier illisible), le fichier d'origine est renvoyé tel quel :
 * mieux vaut une photo lourde qu'un envoi impossible.
 */
export async function prepareImageForUpload(
  file: File,
  maxDimension = MAX_UPLOAD_DIMENSION,
): Promise<ProcessedImage> {
  const fallback: ProcessedImage = { file, originalBytes: file.size, bytes: file.size };

  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return fallback;
  }

  try {
    // « from-image » applique l'orientation EXIF : sans cela, les photos prises
    // en portrait avec un téléphone ressortent couchées.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = targetSize(bitmap.width, bitmap.height, maxDimension);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return fallback;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", UPLOAD_QUALITY);
    });

    if (!blob || blob.size === 0) return fallback;
    // Si la conversion n'apporte rien (image déjà très optimisée), on garde l'original.
    if (blob.size >= file.size) return fallback;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    const processed = new File([blob], `${name}.webp`, { type: "image/webp" });

    return { file: processed, originalBytes: file.size, bytes: processed.size };
  } catch {
    return fallback;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
