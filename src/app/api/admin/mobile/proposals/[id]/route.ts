import { z } from "zod";
import { getProposalReview } from "@/features/admin/moderation-data";
import {
  authorizeMobileAdmin,
  mobileAdminDenied,
  mobileAdminJson,
} from "@/features/admin/mobile/mobile-admin-auth";
import {
  MOBILE_PHOTO_URL_TTL_SECONDS,
  toMobileDetail,
} from "@/features/admin/mobile/mobile-admin-dto";
import { getPublicEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Fiche d'une proposition : données proposées, position, photos (liens
 * signés temporaires), échanges et note interne de l'équipe.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeMobileAdmin(request, "read");
  if (!access.ok) return mobileAdminDenied(access.error);

  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();

  try {
    const review = await getProposalReview(id.data, access.supabase, MOBILE_PHOTO_URL_TTL_SECONDS);
    if (!review) return notFound();
    const proposal = toMobileDetail(review, {
      now: new Date(),
      ttlSeconds: MOBILE_PHOTO_URL_TTL_SECONDS,
      supabaseUrl: getPublicEnv().NEXT_PUBLIC_SUPABASE_URL ?? "",
    });
    return mobileAdminJson({ ok: true, proposal });
  } catch {
    return mobileAdminDenied("unavailable");
  }
}

function notFound() {
  return mobileAdminJson(
    { ok: false, error: "not_found", message: "Proposition introuvable." },
    404,
  );
}
