import { z } from "zod";
import {
  IDEMPOTENCY_KEY_PATTERN,
  MAX_EXCHANGE_LENGTH,
} from "@/features/proposals/domain/change-request";
import { TRACKING_ID_PATTERN } from "@/features/proposals/domain/proposal-status";
import { statusClientKey } from "@/features/proposals/server/status-client-key";
import {
  createSupabaseServiceRoleClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/service-role-server";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    trackingId: z.string().regex(TRACKING_ID_PATTERN),
    email: z
      .string()
      .max(320)
      .transform((value) => value.trim().toLowerCase())
      .pipe(z.string().min(3).max(320)),
    message: z.string().max(MAX_EXCHANGE_LENGTH * 2),
    idempotencyKey: z.string().regex(IDEMPOTENCY_KEY_PATTERN),
  })
  .strict();

const noStore = { "Cache-Control": "no-store" };

/** Message neutre : numéro inconnu, mauvais e-mail ou aucune demande ouverte. */
const NOT_FOUND_MESSAGE =
  "Aucune demande de précisions n'attend de réponse pour cette proposition.";

function errorResponse(error: string, message: string, status: number) {
  return Response.json({ ok: false, error, message }, { status, headers: noStore });
}

/**
 * Réponse du contributeur à une demande de précisions.
 *
 * Entrée : `{ trackingId, email, message, idempotencyKey }`. La demande
 * n'est trouvée que si le numéro ET l'e-mail normalisé correspondent et
 * qu'une demande est ouverte ; sinon la même erreur neutre (404) est
 * renvoyée. Une même clé d'idempotence renvoie le même succès sans créer
 * de seconde réponse. Une réponse valide ferme la demande et remet la
 * proposition dans la file « En cours de vérification ».
 *
 * Sortie : `{ ok: true, status: "in_review" }` ou `{ ok: false, error, message }`.
 * Aucune donnée de la requête n'est journalisée.
 */
export async function POST(request: Request) {
  if (!isServiceRoleConfigured()) {
    return errorResponse("unavailable", "Les réponses ne sont pas encore disponibles.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Requête invalide.", 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("invalid_request", "Requête invalide.", 400);
  }

  const message = parsed.data.message.trim();
  if (message.length < 1 || message.length > MAX_EXCHANGE_LENGTH) {
    return errorResponse(
      "invalid_message",
      `La réponse doit contenir entre 1 et ${MAX_EXCHANGE_LENGTH} caractères.`,
      400,
    );
  }

  let outcome: unknown;
  try {
    const supabase = createSupabaseServiceRoleClient();
    const result = await supabase.rpc("reply_to_proposal_request", {
      p_tracking_id: parsed.data.trackingId,
      p_email: parsed.data.email,
      p_response: message,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_client_key: statusClientKey(request),
    });
    if (result.error) {
      const code = result.error.message ?? "";
      if (code.includes("rate_limit")) {
        return errorResponse(
          "rate_limit",
          "Trop de réponses ont été envoyées récemment. Réessayez dans une heure.",
          429,
        );
      }
      if (code.includes("invalid_response")) {
        return errorResponse(
          "invalid_message",
          `La réponse doit contenir entre 1 et ${MAX_EXCHANGE_LENGTH} caractères.`,
          400,
        );
      }
      if (code.includes("invalid_request")) {
        return errorResponse("invalid_request", "Requête invalide.", 400);
      }
      throw new Error("reply_failed");
    }
    outcome = result.data;
  } catch {
    return errorResponse("unavailable", "Les réponses sont momentanément indisponibles.", 503);
  }

  if (outcome === "received" || outcome === "already_received") {
    // Même réponse pour un premier envoi et pour une nouvelle tentative.
    return Response.json({ ok: true, status: "in_review" }, { headers: noStore });
  }
  if (outcome === "not_found") {
    return errorResponse("not_found", NOT_FOUND_MESSAGE, 404);
  }
  return errorResponse("unavailable", "Les réponses sont momentanément indisponibles.", 503);
}
