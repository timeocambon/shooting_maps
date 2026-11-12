import { getReportQueue } from "@/features/admin/report-data";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import { toMobileReportList } from "@/features/admin/mobile/mobile-report-dto";

export const runtime = "nodejs";

/**
 * Signalements encore à traiter (ouverts ou en cours), priorité haute
 * d'abord puis les plus anciens. Lecture seule.
 */
export async function GET(request: Request) {
  const access = await authorizeMobileAdmin(request, "read");
  if (!access.ok) return mobileAdminDenied(access.error);
  try {
    const list = toMobileReportList(await getReportQueue(access.supabase));
    return mobileAdminJson({ ok: true, ...list });
  } catch {
    return mobileAdminDenied("unavailable");
  }
}
