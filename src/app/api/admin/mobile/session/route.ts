import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";

export const runtime = "nodejs";

/**
 * Droits de la session mobile. 200 : membre de l'équipe en AAL2 ; 403
 * `mfa_required` : membre de l'équipe dont la session est en AAL1 ; 403
 * `forbidden` : compte hors équipe ; 401 : jeton absent, invalide ou expiré.
 */
export async function GET(request: Request) {
  const access = await authorizeMobileAdmin(request, "read");
  if (!access.ok) return mobileAdminDenied(access.error);
  return mobileAdminJson({ ok: true, access: "granted", role: access.role });
}
