import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSessionState =
  | { status: "unconfigured" }
  | { status: "anonymous" }
  | { status: "mfa_required"; email: string }
  | { status: "forbidden"; email: string }
  | {
      status: "authenticated";
      email: string;
      displayName: string | null;
      role: "moderator" | "administrator";
    };

export async function getAdminSessionState(): Promise<AdminSessionState> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user?.email) return { status: "anonymous" };

  const { data: assurance } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") {
    return { status: "mfa_required", email: user.email };
  }

  const { data: profile } = await supabase
    .from("admin_users")
    .select("display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !profile ||
    (profile.role !== "moderator" && profile.role !== "administrator")
  ) {
    return { status: "forbidden", email: user.email };
  }

  return {
    status: "authenticated",
    email: user.email,
    displayName:
      typeof profile.display_name === "string" ? profile.display_name : null,
    role: profile.role,
  };
}
