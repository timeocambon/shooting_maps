"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState = { status: "idle" } | { status: "error"; message: string };

const signUpSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: z.email().max(320),
  password: z.string().min(8).max(200),
});

const signInSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(8).max(200),
});

/**
 * Rattache au compte connecté les fiches photographe portant la même adresse
 * de contact, puis régénère les pages concernées.
 */
async function claimAndRefresh(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc("claim_photographer_profiles");
  if (error) console.error("claim_photographer_profiles", error.message);
  revalidatePath("/mon-espace");
}

export async function signUpAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service de comptes n’est pas encore connecté." };
  }

  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Vérifiez votre nom (2 caractères minimum), votre e-mail et un mot de passe d’au moins 8 caractères.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error("signUp", error.message);
    const alreadyUsed = error.message.toLowerCase().includes("already");
    return {
      status: "error",
      message: alreadyUsed
        ? "Un compte existe déjà avec cette adresse. Utilisez la page de connexion."
        : "La création du compte a échoué. Réessayez dans quelques instants.",
    };
  }

  const { error: profileError } = await supabase.rpc("ensure_my_profile", {
    p_display_name: parsed.data.displayName,
  });
  if (profileError) console.error("ensure_my_profile", profileError.message);

  await claimAndRefresh(supabase);
  redirect("/mon-espace");
}

export async function signInAccountAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service de comptes n’est pas encore connecté." };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Saisissez une adresse e-mail valide et votre mot de passe." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", message: "Identifiants incorrects." };
  }

  await claimAndRefresh(supabase);
  redirect("/mon-espace");
}

export async function signOutAccountAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/");
  redirect("/");
}
