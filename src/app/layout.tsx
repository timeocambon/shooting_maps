import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { getPlausibleDomain } from "@/lib/env";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Spotride — Trouvez votre prochain décor",
    template: "%s · Spotride",
  },
  description:
    "Des spots vérifiés pour préparer vos shootings photo moto.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Spotride — Trouvez votre prochain décor",
    description:
      "Des spots vérifiés pour préparer vos shootings photo moto.",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "Spotride, une moto garée au bord d'une route de campagne au coucher du soleil",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotride — Trouvez votre prochain décor",
    description:
      "Des spots vérifiés pour préparer vos shootings photo moto.",
    images: ["/og.jpg"],
  },
  // Le site est ouvert à l'indexation. Les pages privées (administration,
  // espace personnel, formulaires) portent leur propre « noindex ».
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#f6f0e8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const plausibleDomain = getPlausibleDomain();

  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
            strategy="afterInteractive"
          />
        ) : null}
        {children}
      </body>
    </html>
  );
}
