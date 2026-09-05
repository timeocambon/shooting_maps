import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Spotride Toulouse · MVP en développement</p>
      <nav aria-label="Liens secondaires">
        <Link href="/charte">Charte</Link>
        <Link href="/admin">Administration</Link>
      </nav>
    </footer>
  );
}
