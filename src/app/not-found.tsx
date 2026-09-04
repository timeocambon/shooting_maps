import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <section className="simple-page centered-page">
          <p className="kicker">Erreur 404</p>
          <h1>Ce spot n&apos;est pas disponible.</h1>
          <p>Il a peut-être été masqué, archivé ou son adresse a changé.</p>
          <Link className="button" href="/">Revenir à la carte</Link>
        </section>
      </div>
    </main>
  );
}
