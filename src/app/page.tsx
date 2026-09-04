import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MapExplorer } from "@/features/spots/components/map-explorer";
import { getPublishedSpots } from "@/features/spots/data/spot-repository";
import { getMapStyleUrl } from "@/lib/env";

export default async function HomePage() {
  const spots = await getPublishedSpots();
  const usesDemoData = spots.some((spot) => spot.isDemo);

  return (
    <main>
      <div className="home-shell">
        <SiteHeader />
        <section className="hero">
          <div>
            <p className="kicker">La carte photo des motards toulousains</p>
            <h1>
              Le bon décor.<br />
              <em>Au bon moment.</em>
            </h1>
          </div>
          <p className="hero-copy">
            Repérez des lieux documentés, anticipez la lumière et vérifiez
            l&apos;accès avant de prendre la route.
          </p>
        </section>

        {usesDemoData ? (
          <p className="demo-banner" role="status">
            <strong>Socle de développement</strong>
            Les trois fiches affichées sont fictives. Elles seront remplacées dès
            que la base Supabase locale sera configurée.
          </p>
        ) : null}

        <MapExplorer spots={spots} mapStyleUrl={getMapStyleUrl()} />
        <SiteFooter />
      </div>
    </main>
  );
}
