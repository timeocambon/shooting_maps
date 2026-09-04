import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { signInAction } from "@/app/admin/actions";
import { isSupabaseConfigured } from "@/lib/env";

type LoginPageProps = {
  searchParams: Promise<{ erreur?: string }>;
};

const errorMessages: Record<string, string> = {
  configuration: "Supabase doit être configuré avant la connexion.",
  identifiants: "Saisissez une adresse e-mail valide et un mot de passe d'au moins huit caractères.",
  connexion: "La connexion a échoué. Vérifiez vos identifiants.",
};

export const metadata = { title: "Connexion administrateur" };

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { erreur } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="admin-gate">
      <section>
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour au site</Link>
        <span className="admin-icon"><LockKeyhole aria-hidden="true" /></span>
        <p className="kicker">Administration</p>
        <h1>Connexion sécurisée</h1>
        <p>Après le mot de passe, un code généré par votre application d&apos;authentification sera demandé.</p>
        {erreur ? <p className="form-error" role="alert">{errorMessages[erreur] ?? "Une erreur est survenue."}</p> : null}
        {!configured ? <p className="form-error">La configuration Supabase locale est absente.</p> : null}
        <form className="auth-form" action={signInAction}>
          <label>Adresse e-mail<input name="email" type="email" autoComplete="username" required /></label>
          <label>Mot de passe<input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
          <button className="button" type="submit" disabled={!configured}>Continuer</button>
        </form>
      </section>
    </main>
  );
}
