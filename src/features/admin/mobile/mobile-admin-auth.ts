import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Contrôle d'accès des endpoints /api/admin/mobile/*.
 *
 * Chaque requête doit porter le jeton de la session Supabase de l'application
 * (`Authorization: Bearer …`). Aucun rôle envoyé par l'application n'est lu :
 *
 * 1. le JWT est vérifié par Supabase Auth (`getClaims`) ;
 * 2. `public.admin_mobile_access` est appelée **avec ce jeton** : la base
 *    vérifie de nouveau le JWT, l'appartenance à l'équipe (`admin_users`),
 *    le niveau AAL2 et la limitation de fréquence ;
 * 3. les données sont lues avec ce même client, donc sous les politiques RLS
 *    existantes (`private.is_staff()`) — jamais avec la clé de service.
 */

export type MobileAdminClient = SupabaseClient<Database>;
export type MobileAdminRole = "moderator" | "administrator";
export type MobileAdminAction = "read" | "write";

export type MobileAdminDenial =
  | "unauthenticated"
  | "session_expired"
  | "forbidden"
  | "mfa_required"
  | "rate_limit"
  | "unavailable";

export type MobileAdminAccess =
  | { ok: true; supabase: MobileAdminClient; role: MobileAdminRole }
  | { ok: false; error: MobileAdminDenial };

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 8192;

/** Jeton du header `Authorization: Bearer …`, ou `null` s'il est absent ou mal formé. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header || header.length > MAX_TOKEN_LENGTH + 7) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match || !JWT_PATTERN.test(match[1])) return null;
  return match[1];
}

/**
 * Date d'expiration lue sans vérification, uniquement pour choisir le
 * message (« session expirée ») d'un jeton déjà refusé.
 */
function expiredUnverified(token: string, now: number): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof payload.exp === "number" && payload.exp * 1000 <= now;
  } catch {
    return false;
  }
}

/** Client Supabase lié au jeton de l'appelant (clé publique, aucune session conservée). */
export function createMobileAdminClient(token: string): MobileAdminClient | null {
  const env = getPublicEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function authorizeMobileAdmin(
  request: Request,
  action: MobileAdminAction,
  {
    createClientForToken = createMobileAdminClient,
    now = Date.now,
  }: {
    createClientForToken?: (token: string) => MobileAdminClient | null;
    now?: () => number;
  } = {},
): Promise<MobileAdminAccess> {
  const token = readBearerToken(request);
  if (!token) return { ok: false, error: "unauthenticated" };
  const rejected = (): MobileAdminAccess => ({
    ok: false,
    error: expiredUnverified(token, now()) ? "session_expired" : "unauthenticated",
  });

  const supabase = createClientForToken(token);
  if (!supabase) return { ok: false, error: "unavailable" };

  let claims: Record<string, unknown> | null = null;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) return rejected();
    claims = data.claims as Record<string, unknown>;
  } catch {
    return rejected();
  }
  if (typeof claims.sub !== "string" || claims.role !== "authenticated") return rejected();
  if (typeof claims.exp === "number" && claims.exp * 1000 <= now()) {
    return { ok: false, error: "session_expired" };
  }

  const { data: access, error } = await supabase.rpc("admin_mobile_access", { p_action: action });
  if (error) {
    // JWT refusé par PostgREST (expiré entre-temps, révoqué…) : 401.
    const code = (error as { code?: string }).code ?? "";
    if (code === "PGRST301" || code === "PGRST303" || /jwt/i.test(error.message ?? "")) return rejected();
    return { ok: false, error: "unavailable" };
  }

  if (access === "moderator" || access === "administrator") {
    // Double contrôle : le jeton vérifié doit lui aussi être en AAL2.
    if (claims.aal !== "aal2") return { ok: false, error: "mfa_required" };
    return { ok: true, supabase, role: access };
  }
  if (access === "mfa_required" || access === "rate_limit" || access === "forbidden") {
    return { ok: false, error: access };
  }
  return { ok: false, error: "forbidden" };
}

const DENIAL_RESPONSES: Record<MobileAdminDenial, { status: number; message: string }> = {
  unauthenticated: { status: 401, message: "Connexion requise." },
  session_expired: { status: 401, message: "Session expirée. Reconnecte-toi." },
  forbidden: { status: 403, message: "Accès réservé à l’équipe de modération." },
  mfa_required: { status: 403, message: "Vérification en deux étapes requise." },
  rate_limit: { status: 429, message: "Trop de requêtes. Réessaie dans quelques instants." },
  unavailable: { status: 503, message: "Service momentanément indisponible." },
};

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
  Vary: "Authorization",
} as const;

export function mobileAdminJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function mobileAdminDenied(error: MobileAdminDenial): Response {
  const { status, message } = DENIAL_RESPONSES[error];
  return mobileAdminJson({ ok: false, error, message }, status);
}
