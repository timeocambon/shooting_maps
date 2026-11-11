import { createHash } from "node:crypto";

/**
 * Empreinte du client pour la limitation des vérifications de statut
 * (jamais l'adresse IP en clair) : première adresse de `x-forwarded-for`
 * (plateforme d'hébergement), sinon `x-real-ip`, sinon un compartiment commun.
 */
export function statusClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "inconnu";
  return createHash("sha256").update(`spotride:proposal-status:${address}`).digest("hex");
}
