"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AccountLinks = { signedIn: boolean; isAdmin: boolean };

export function SiteHeaderMenu() {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<AccountLinks | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // La session est lue côté navigateur : les pages publiques restent ainsi
  // générées statiquement, au lieu d'être rendues à chaque requête.
  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        if (!data.user) {
          setAccount({ signedIn: false, isAdmin: false });
          return;
        }
        const { data: isAdmin } = await supabase.rpc("am_i_admin");
        if (active) setAccount({ signedIn: true, isAdmin: Boolean(isAdmin) });
      } catch {
        if (active) setAccount({ signedIn: false, isAdmin: false });
      }
    }

    loadAccount();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="header-menu" ref={containerRef}>
      <button
        type="button"
        className="header-menu-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((current) => !current)}
      >
        <Menu size={17} aria-hidden="true" />
        <span className="header-menu-label">Menu</span>
        <ChevronDown size={15} aria-hidden="true" className={open ? "flipped" : ""} />
      </button>
      {open ? (
        <div className="header-menu-panel" role="menu">
          <Link href="/proposer" role="menuitem" className="header-menu-cta" onClick={() => setOpen(false)}>
            Proposer un spot
          </Link>
          <Link href="/photographes" role="menuitem" onClick={() => setOpen(false)}>
            Photographes
          </Link>

          <Link
            href={account?.signedIn ? "/mon-espace" : "/compte"}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {account?.signedIn ? "Mon espace" : "Connexion / Inscription"}
          </Link>

          {account?.isAdmin ? (
            <Link href="/admin" role="menuitem" className="header-menu-admin" onClick={() => setOpen(false)}>
              Administration
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
