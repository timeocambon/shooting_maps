import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { getPlausibleDomain } from "@/lib/env";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Spotride Toulouse — Trouvez votre prochain décor",
    template: "%s · Spotride Toulouse",
  },
  description:
    "Des spots vérifiés autour de Toulouse pour préparer vos shootings photo moto.",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "Spotride Toulouse — Trouvez votre prochain décor",
    description:
      "Des spots vérifiés autour de Toulouse pour préparer vos shootings photo moto.",
    images: [
      {
        url: "/og.png",
        width: 1731,
        height: 909,
        alt: "Spotride Toulouse, une moto face aux collines au coucher du soleil",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Spotride Toulouse — Trouvez votre prochain décor",
    description:
      "Des spots vérifiés autour de Toulouse pour préparer vos shootings photo moto.",
    images: ["/og.png"],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
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
