import { getModerationQueue } from "@/features/admin/moderation-data";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import { toMobileQueue } from "@/features/admin/mobile/mobile-admin-dto";

export const runtime = "nodejs";

/** File de modération : propositions en vérification et réponses reçues. */
export async function GET(request: Request) {
  const access = await authorizeMobileAdmin(request, "read");
  if (!access.ok) return mobileAdminDenied(access.error);
  try {
    const items = toMobileQueue(await getModerationQueue(access.supabase));
    return mobileAdminJson({ ok: true, items });
  } catch {
    return mobileAdminDenied("unavailable");
  }
}
