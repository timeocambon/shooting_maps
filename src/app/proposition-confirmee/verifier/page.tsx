import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { confirmProposalEmailAction } from "@/app/proposition-confirmee/actions";

type VerifyPageProps = { searchParams: Promise<{ jeton?: string }> };

export const metadata: Metadata = {
  title: "Confirmer votre adresse",
  robots: { index: false, follow: false },
};

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { jeton } = await searchParams;

  return (
    <main className="admin-gate">
      <section>
        <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour au site</Link>
        <span className="admin-icon"><MailCheck /></span>
        <p className="kicker">Vérification de l&apos;e-mail</p>
        <h1>Confirmez l&apos;envoi.</h1>
        <p>Cette action place votre proposition dans la file de modération. Elle ne la publie pas.</p>
        {jeton ? (
          <form action={confirmProposalEmailAction}>
            <input type="hidden" name="token" value={jeton} />
            <button className="button" type="submit">Confirmer mon adresse e-mail</button>
          </form>
        ) : <p className="form-error">Le lien ne contient aucun jeton de confirmation.</p>}
      </section>
    </main>
  );
}
