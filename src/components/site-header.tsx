import Link from "next/link";
import { MapPinned } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Spotride — accueil">
        <span className="brand-mark" aria-hidden="true">
          <MapPinned size={20} strokeWidth={2.2} />
        </span>
        <span>
          <strong>Spotride</strong>
        </span>
      </Link>

      <nav className="main-nav" aria-label="Navigation principale">
        <Link href="/a-propos">Le projet</Link>
        <Link className="button button-small" href="/proposer">
          Proposer un spot
        </Link>
      </nav>
    </header>
  );
}
