"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  // Quand la confirmation d'adresse est activée dans Supabase, signUp ne rend
  // aucune session : le compte n'existe vraiment qu'après le clic dans l'e-mail.
  | { status: "confirmation-sent"; email: string };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

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
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirmation`,
      // Le profil ne peut être créé qu'une fois la session ouverte. En
      // attendant, le nom voyage avec le compte Supabase et sera repris par
      // la route de confirmation.
      data: { display_name: parsed.data.displayName },
    },
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

  // Aucune session : Supabase attend la confirmation de l'adresse. Inutile
  // d'appeler les RPC, elles s'exécuteraient en anonyme et échoueraient.
  if (!data.session) {
    return { status: "confirmation-sent", email: parsed.data.email };
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
    const unconfirmed = error.message.toLowerCase().includes("not confirmed");
    return {
      status: "error",
      message: unconfirmed
        ? "Votre adresse n'est pas encore confirmée : ouvrez le lien reçu par e-mail."
        : "Identifiants incorrects.",
    };
  }

  await claimAndRefresh(supabase);
  redirect("/mon-espace");
}

const displayNameSchema = z.string().trim().min(2).max(80);

export async function updateDisplayNameAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { status: "error", message: "Le service de comptes n’est pas encore connecté." };
  }

  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) {
    return { status: "error", message: "Votre nom doit contenir entre 2 et 80 caractères." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ensure_my_profile", { p_display_name: parsed.data });

  if (error) {
    console.error("ensure_my_profile", error.message);
    return { status: "error", message: "L’enregistrement du nom a échoué." };
  }

  revalidatePath("/mon-espace", "layout");
  return { status: "idle" };
}

export async function signOutAccountAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/");
  redirect("/");
}
