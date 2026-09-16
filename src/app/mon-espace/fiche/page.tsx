import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PhotographerEditForm } from "@/features/account/components/photographer-edit-form";
import { getAccountState, getMyPhotographerProfile } from "@/features/account/account-session";
import { socialLinkSchema, type SocialLink } from "@/features/photographers/domain/photographer";

export const metadata = { title: "Modifier ma fiche", robots: { index: false, follow: false } };

function parseSocials(value: unknown): SocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => socialLinkSchema.safeParse(item))
    .filter((result): result is { success: true; data: SocialLink } => result.success)
    .map((result) => result.data);
}

export default async function EditMyPhotographerPage() {
  const account = await getAccountState();
  if (account.status !== "authenticated") redirect("/connexion");

  const photographer = await getMyPhotographerProfile();
  if (!photographer) redirect("/devenir-photographe");

  return (
    <main>
      <div className="content-shell">
        <SiteHeader />
        <Link className="back-link" href="/mon-espace"><ArrowLeft size={17} /> Retour à mon espace</Link>

        <section className="hero">
          <p className="kicker">Ma fiche photographe</p>
          <h1>{photographer.name}</h1>
          {photographer.publicationState !== "published" ? (
            <p className="lead">Cette fiche n’est pas encore visible publiquement : elle attend la validation de l’équipe.</p>
          ) : null}
        </section>

        <PhotographerEditForm
          photographerId={photographer.id}
          name={photographer.name}
          tagline={photographer.tagline}
          bio={photographer.bio}
          locationLabel={photographer.locationLabel ?? ""}
          socials={parseSocials(photographer.socials)}
          photos={photographer.photos}
        />

        <SiteFooter />
      </div>
    </main>
  );
}
