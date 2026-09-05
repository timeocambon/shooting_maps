import Link from "next/link";
import { MapPinned } from "lucide-react";
import { signOutAction } from "@/app/admin/actions";

type AdminSidebarProps = { active: "dashboard" | "proposals" | "spots" | "reports" | "withdrawals" };

export function AdminSidebar({ active }: AdminSidebarProps) {
  return (
    <aside className="admin-sidebar">
      <Link className="brand inverse" href="/"><span className="brand-mark"><MapPinned size={20} /></span><span><strong>Spotride</strong><small>Administration</small></span></Link>
      <nav aria-label="Administration">
        <Link className={active === "dashboard" ? "active" : ""} href="/admin">Vue d&apos;ensemble</Link>
        <Link className={active === "proposals" ? "active" : ""} href="/admin/propositions">Propositions</Link>
        <Link className={active === "reports" ? "active" : ""} href="/admin/signalements">Signalements</Link>
        <Link className={active === "withdrawals" ? "active" : ""} href="/admin/retraits">Demandes de retrait</Link>
        <Link className={active === "spots" ? "active" : ""} href="/admin/spots">Catalogue</Link>
      </nav>
      <form action={signOutAction}><button type="submit">Se déconnecter</button></form>
    </aside>
  );
}
