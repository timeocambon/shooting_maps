import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Spotride · La carte photo des motards</p>
      <nav aria-label="Liens secondaires">
        <Link href="/comment-ca-marche">Comment ça marche</Link>
        <Link href="/a-propos">Le projet</Link>
        <Link href="/photographes">Photographes</Link>
        <Link href="/charte">Charte</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/demande-de-retrait">Demande de retrait</Link>
      </nav>
    </footer>
  );
}
