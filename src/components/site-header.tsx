import Link from "next/link";
import Image from "next/image";
import { SiteHeaderMenu } from "@/components/site-header-menu";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Spotride — accueil">
        <span className="brand-mark" aria-hidden="true">
          <Image src="/brand/logo-mark.png" alt="" width={56} height={56} priority />
        </span>
        <span>
          <strong>Spotride</strong>
        </span>
      </Link>

      <nav className="main-nav" aria-label="Navigation principale">
        <SiteHeaderMenu />
        <Link className="button button-small" href="/proposer">
          Proposer un spot
        </Link>
      </nav>
    </header>
  );
}
