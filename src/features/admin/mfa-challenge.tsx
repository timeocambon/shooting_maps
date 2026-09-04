"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type MfaChallengeProps = { configured: boolean };

export function MfaChallenge({ configured }: MfaChallengeProps) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(
    configured
      ? "Préparation de la vérification…"
      : "Supabase doit être configuré avant d'activer le second facteur.",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();

    async function prepareFactor() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.replace("/admin/connexion");
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) {
        if (!cancelled) setMessage(factorsError.message);
        return;
      }

      const verifiedFactor = factors.totp.find((factor) => factor.status === "verified");
      if (verifiedFactor) {
        if (!cancelled) {
          setFactorId(verifiedFactor.id);
          setMessage("Saisissez le code à six chiffres de votre application.");
        }
        return;
      }

      const pendingFactor = factors.all.find(
        (factor) => factor.factor_type === "totp" && factor.status === "unverified",
      );
      if (pendingFactor) await supabase.auth.mfa.unenroll({ factorId: pendingFactor.id });

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Spotride administration",
      });

      if (enrollmentError || !enrollment) {
        if (!cancelled) setMessage(enrollmentError?.message ?? "Activation impossible.");
        return;
      }

      if (!cancelled) {
        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setMessage("Scannez le QR code puis saisissez le code à six chiffres.");
      }
    }

    void prepareFactor();
    return () => { cancelled = true; };
  }, [configured, router]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setMessage("Saisissez un code valide à six chiffres.");
      return;
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

    if (error) {
      setMessage("Le code n'est pas valide ou a expiré.");
      setBusy(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      <span className="admin-icon"><KeyRound aria-hidden="true" /></span>
      <p className="kicker">Double authentification</p>
      <h1>Protégez les actions de modération.</h1>
      <p>{message}</p>
      {qrCode ? (
        // The authentication service returns an in-memory QR data URL, which
        // must be rendered directly instead of going through image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="mfa-qr" src={qrCode} width={200} height={200} alt="QR code d'activation du second facteur" />
      ) : null}
      <form className="auth-form" onSubmit={verify}>
        <label>Code à six chiffres<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} required /></label>
        <button className="button" type="submit" disabled={!factorId || busy}>{busy ? "Vérification…" : "Valider le code"}</button>
      </form>
    </>
  );
}
