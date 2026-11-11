import { z } from "zod";
import {
  isPublicProposalStatus,
  MAX_STATUS_ITEMS,
  TRACKING_ID_PATTERN,
} from "@/features/proposals/domain/proposal-status";
import { statusClientKey } from "@/features/proposals/server/status-client-key";
import {
  createSupabaseServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service-role-server";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            trackingId: z.string().regex(TRACKING_ID_PATTERN),
            email: z
              .string()
              .max(320)
              .transform((value) => value.trim().toLowerCase())
              .pipe(z.string().min(3).max(320)),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_STATUS_ITEMS),
  })
  .strict();

const rowSchema = z.object({
  tracking_id: z.string(),
  status: z.string(),
  updated_at: z.string().nullable(),
});

const noStore = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number) {
  return Response.json({ ok: false, message }, { status, headers: noStore });
}

/**
 * Statut public des propositions envoyées depuis un appareil.
 *
 * Entrée : `{ items: [{ trackingId, email }] }` (1 à 20 éléments, issus des
 * reçus locaux). Chaque statut n'est lu que si le numéro ET l'e-mail
 * normalisé correspondent ; sinon la réponse est neutre (`unknown`, sans
 * date), identique pour un numéro inconnu et pour un mauvais e-mail.
 *
 * Sortie : `{ ok: true, results: [{ trackingId, status, updatedAt }] }`, dans
 * l'ordre de la requête, sans doublon. Ni e-mail, ni identifiant interne,
 * ni commentaire de modération. Aucune donnée de la requête n'est journalisée.
 */
export async function POST(request: Request) {
  if (!isServiceRoleConfigured()) {
    return errorResponse("Le suivi des propositions n'est pas encore configuré.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Requête invalide.", 400);
  }

  const items: { trackingId: string; email: string }[] = [];
  for (const item of parsed.data.items) {
    if (!items.some((known) => known.trackingId === item.trackingId)) items.push(item);
  }

  let data: unknown;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const result = await supabase.rpc("lookup_proposal_statuses", {
      p_items: items,
      p_client_key: statusClientKey(request),
    });
    if (result.error) {
      if (result.error.message?.includes("rate_limit")) {
        return errorResponse(
          "Trop de vérifications ont été demandées. Réessayez dans quelques minutes.",
          429,
        );
      }
      throw new Error("lookup_failed");
    }
    data = result.data;
  } catch {
    return errorResponse("Le suivi des propositions est momentanément indisponible.", 503);
  }

  const rows = z.array(rowSchema).safeParse(data);
  if (!rows.success) {
    return errorResponse("Le suivi des propositions est momentanément indisponible.", 503);
  }

  const byTracking = new Map(rows.data.map((row) => [row.tracking_id, row]));
  const results = items.map(({ trackingId }) => {
    const row = byTracking.get(trackingId);
    const status = row && isPublicProposalStatus(row.status) ? row.status : "unknown";
    const updatedAt =
      status !== "unknown" && row?.updated_at && !Number.isNaN(Date.parse(row.updated_at))
        ? new Date(row.updated_at).toISOString()
        : null;
    return { trackingId, status, updatedAt };
  });

  return Response.json({ ok: true, results }, { headers: noStore });
}
