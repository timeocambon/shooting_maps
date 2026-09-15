"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";

const links = [
  { href: "/a-propos", label: "Le projet" },
  { href: "/photographes", label: "Photographes" },
];

export function SiteHeaderMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
          {links.map((link) => (
            <Link key={link.href} href={link.href} role="menuitem" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
