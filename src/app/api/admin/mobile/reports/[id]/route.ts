import { z } from "zod";
import { getReportReview } from "@/features/admin/report-data";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import { toMobileReportDetail } from "@/features/admin/mobile/mobile-report-dto";
import { getPublicEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Détail d'un signalement (lecture seule), sans coordonnées de la personne qui signale. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeMobileAdmin(request, "read");
  if (!access.ok) return mobileAdminDenied(access.error);

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return reportNotFound();

  try {
    const review = await getReportReview(id.data, access.supabase);
    if (!review) return reportNotFound();
    const report = toMobileReportDetail(review, {
      supabaseUrl: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL ?? "",
    });
    if (!report) {
      return mobileAdminJson(
        { ok: false, error: "spot_not_found", message: "Le spot concerné n’existe plus." },
        404,
      );
    }
    return mobileAdminJson({ ok: true, report });
  } catch {
    return mobileAdminDenied("unavailable");
  }
}

function reportNotFound() {
  return mobileAdminJson({ ok: false, error: "not_found", message: "Signalement introuvable." }, 404);
}
