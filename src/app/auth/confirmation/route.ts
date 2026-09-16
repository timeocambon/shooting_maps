import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Point d'arrivée du lien de confirmation envoyé par e-mail.
 *
 * Deux formats sont acceptés : « token_hash » (gabarit d'e-mail personnalisé,
 * fonctionne même si la personne ouvre le lien dans un autre navigateur) et
 * « code » (gabarit par défaut de Supabase, lié au navigateur d'origine).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();
  let confirmed = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.error("[confirmation] verifyOtp", error.message);
    confirmed = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.error("[confirmation] exchangeCodeForSession", error.message);
    confirmed = !error;
  }

  if (!confirmed) {
    return NextResponse.redirect(new URL("/compte?confirmation=echec", origin));
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Premier passage seulement : ne pas écraser un nom que la personne
    // aurait déjà modifié depuis son espace.
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.display_name) {
      const metadataName = user.user_metadata?.display_name;
      const { error } = await supabase.rpc(
        "ensure_my_profile",
        typeof metadataName === "string" && metadataName.trim()
          ? { p_display_name: metadataName }
          : {},
      );
      if (error) console.error("[confirmation] ensure_my_profile", error.message);
    }

    // L'adresse est désormais vérifiée : le rattachement des fiches
    // photographe portant cette adresse peut se faire sans risque.
    const { error: claimError } = await supabase.rpc("claim_photographer_profiles");
    if (claimError) console.error("[confirmation] claim_photographer_profiles", claimError.message);
  }

  revalidatePath("/mon-espace");
  return NextResponse.redirect(new URL("/mon-espace", origin));
}
