import Link from "next/link";
import Image from "next/image";
import { signOutAction } from "@/app/admin/actions";

type AdminSidebarProps = {
  active: "dashboard" | "proposals" | "spots" | "reports" | "withdrawals" | "photographers" | "reviews";
};

export function AdminSidebar({ active }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <Link className="brand inverse" href="/">
        {/* Version blanche : la barre d'administration est sur fond sombre. */}
        <span className="brand-mark"><Image src="/brand/logo-mark-white.png" alt="" width={40} height={40} /></span>
        <span><strong>Spotride</strong><small>Administration</small></span>
      </Link>
      <nav aria-label="Administration">
        <Link className={active === "dashboard" ? "active" : ""} href="/admin">Vue d&apos;ensemble</Link>
        <Link className={active === "proposals" ? "active" : ""} href="/admin/propositions">Propositions</Link>
        <Link className={active === "reports" ? "active" : ""} href="/admin/signalements">Signalements</Link>
        <Link className={active === "withdrawals" ? "active" : ""} href="/admin/retraits">Demandes de retrait</Link>
        <Link className={active === "spots" ? "active" : ""} href="/admin/spots">Catalogue</Link>
        <Link className={active === "photographers" ? "active" : ""} href="/admin/photographes">Photographes</Link>
        <Link className={active === "reviews" ? "active" : ""} href="/admin/avis">Avis</Link>
      </nav>
      <form action={signOutAction}><button type="submit">Se déconnecter</button></form>
    </aside>
  );
}
