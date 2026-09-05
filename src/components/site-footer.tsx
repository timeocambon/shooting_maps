import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Spotride Toulouse · MVP en développement</p>
      <nav aria-label="Liens secondaires">
        <Link href="/a-propos">Le projet</Link>
        <Link href="/charte">Charte</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
        <Link href="/demande-de-retrait">Demande de retrait</Link>
        <Link href="/admin">Administration</Link>
      </nav>
    </footer>
  );
}
