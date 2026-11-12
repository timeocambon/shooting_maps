import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendProposalDecisionEmail } from "@/features/proposals/server/confirmation-email";
import { getServerEnv } from "@/lib/server-env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Décisions finales (publication, refus, doublon), communes à
 * l'administration du site et à l'administration mobile.
 *
 * - Toujours appelée avec la session de l'équipe (cookies du site ou jeton
 *   de l'application) : RLS et `private.is_staff()` s'appliquent, jamais la
 *   clé de service.
 * - `admin_review_proposal` reste la source de vérité des transitions
 *   (verrou de ligne, état `submitted` exigé, un seul spot par proposition).
 * - En amont, `admin_claim_proposal_decision` garantit qu'une seule tentative
 *   à la fois prépare les photos publiques (double appui, deux modérateurs,
 *   fiche obsolète).
 * - Publication : seules les versions traitées WebP (privées) sont copiées
 *   dans `spot-published`, dans l'ordre, sous `spots/{proposition}/NN.webp`.
 *   Les originaux ne sont jamais lus ni publiés. Toute copie créée par la
 *   tentative est supprimée si une étape échoue.
 * - La note interne n'est transmise qu'à `admin_review_proposal` ; jamais à
 *   l'e-mail ni à la réponse.
 */

export type FinalDecision = "approved" | "rejected" | "duplicate";

export type DecisionInput = {
  proposalId: string;
  decision: FinalDecision;
  internalNote: string;
  displayPrecision: "exact" | "approximate";
  sensitive: boolean;
  /** `updated_at` de la proposition au chargement de la fiche (facultatif). */
  expectedVersion?: string | null;
};

export type DecisionFailure =
  | "forbidden"
  | "not_found"
  | "already_reviewed"
  | "proposal_changed"
  | "decision_in_progress"
  | "invalid_photo_count"
  | "photo_download_failed"
  | "photo_publish_failed"
  | "decision_failed";

export type DecisionResult =
  | {
      ok: true;
      decision: FinalDecision;
      /** Spot créé (publication uniquement) : informations publiques seulement. */
      spot: { slug: string; url: string | null; sensitive: boolean } | null;
      emailSent: boolean;
    }
  | { ok: false; reason: DecisionFailure };

type Client = SupabaseClient<Database>;

export type DecisionDeps = {
  sendEmail: typeof sendProposalDecisionEmail;
  revalidate: (path: string) => void;
  siteUrl: () => string;
};

const defaultDeps: DecisionDeps = {
  sendEmail: sendProposalDecisionEmail,
  revalidate: (path) => revalidatePath(path),
  siteUrl: () => getServerEnv().NEXT_PUBLIC_SITE_URL,
};

/** Bucket privé des propositions et bucket public des spots. */
const PRIVATE_BUCKET = "spot-originals";
const PUBLIC_BUCKET = "spot-published";

/**
 * Seules les variantes traitées (WebP, métadonnées retirées) de cette
 * proposition peuvent devenir publiques — jamais un `original-…`.
 */
export function isProcessedPath(path: string, proposalId: string): boolean {
  return (
    path.startsWith(`proposals/${proposalId}/`) &&
    /^proposals\/[0-9a-f-]{36}\/[A-Za-z0-9_-]{16,128}\/processed-\d+-[0-9a-f-]{36}\.webp$/.test(path)
  );
}

/** Chemin public déterministe : un dossier par proposition, ordre sur deux chiffres. */
export function publishedPhotoPath(proposalId: string, index: number): string {
  return `spots/${proposalId}/${String(index + 1).padStart(2, "0")}.webp`;
}

/** Signature WebP (« RIFF….WEBP ») : jamais d'autre format publié. */
export function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

type Photo = { processed_object_path: string | null; display_order: number; moderation_state: string };

/** Photos publiables, dans l'ordre : même sélection que `admin_review_proposal`. */
export function publishablePhotos(photos: readonly Photo[]): Photo[] {
  return photos
    .filter((photo) => photo.processed_object_path && photo.moderation_state !== "rejected")
    .sort((left, right) => left.display_order - right.display_order);
}

async function removePublished(supabase: Client, paths: string[]) {
  if (!paths.length) return;
  try {
    await supabase.storage.from(PUBLIC_BUCKET).remove(paths);
  } catch {
    // Nettoyage best-effort : le prochain essai réécrit les mêmes chemins.
  }
}

export async function decideProposal(
  supabase: Client,
  input: DecisionInput,
  deps: Partial<DecisionDeps> = {},
): Promise<DecisionResult> {
  const { sendEmail, revalidate, siteUrl } = { ...defaultDeps, ...deps };

  // 1. Verrou : état réel relu en base, version de la fiche comparée.
  const { data: claim, error: claimError } = await supabase.rpc("admin_claim_proposal_decision", {
    p_proposal_id: input.proposalId,
    p_expected_version: input.expectedVersion ?? undefined,
  });
  if (claimError) {
    return { ok: false, reason: (claimError.message ?? "").includes("forbidden") ? "forbidden" : "decision_failed" };
  }
  const claimStatus = (claim as { status?: unknown; claim_id?: unknown } | null)?.status;
  const claimId = (claim as { claim_id?: unknown } | null)?.claim_id;
  if (claimStatus === "already_reviewed") return { ok: false, reason: "already_reviewed" };
  if (claimStatus === "changed") return { ok: false, reason: "proposal_changed" };
  if (claimStatus === "busy") return { ok: false, reason: "decision_in_progress" };
  if (claimStatus !== "claimed" || typeof claimId !== "string") return { ok: false, reason: "decision_failed" };

  const published: string[] = [];
  // Une fois la décision enregistrée, les copies publiques appartiennent au spot.
  let decided = false;
  try {
    const { data: proposal, error: readError } = await supabase
      .from("proposals")
      .select("id, state, tracking_id, contributor_email, proposal_photos(processed_object_path, display_order, moderation_state)")
      .eq("id", input.proposalId)
      .maybeSingle();
    if (readError) return { ok: false, reason: "decision_failed" };
    if (!proposal) return { ok: false, reason: "not_found" };
    if (proposal.state !== "submitted") return { ok: false, reason: "already_reviewed" };

    // 2. Publication des photos (acceptation seulement).
    const publicUrls: string[] = [];
    if (input.decision === "approved") {
      const photos = publishablePhotos(proposal.proposal_photos ?? []);
      if (photos.length < 2 || photos.length > 6) return { ok: false, reason: "invalid_photo_count" };
      if (!photos.every((photo) => isProcessedPath(photo.processed_object_path ?? "", input.proposalId))) {
        return { ok: false, reason: "photo_download_failed" };
      }
      for (const [index, photo] of photos.entries()) {
        const { data: blob, error: downloadError } = await supabase.storage
          .from(PRIVATE_BUCKET)
          .download(photo.processed_object_path!);
        if (downloadError || !blob) {
          await removePublished(supabase, published);
          return { ok: false, reason: "photo_download_failed" };
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!isWebp(bytes)) {
          await removePublished(supabase, published);
          return { ok: false, reason: "photo_download_failed" };
        }
        const path = publishedPhotoPath(input.proposalId, index);
        // Le verrou garantit qu'aucune autre tentative n'écrit ici ; un reste
        // d'une tentative interrompue est remplacé.
        const { error: uploadError } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, bytes, {
          contentType: "image/webp",
          cacheControl: "31536000",
          upsert: true,
        });
        if (uploadError) {
          await removePublished(supabase, [...published, path]);
          return { ok: false, reason: "photo_publish_failed" };
        }
        published.push(path);
        publicUrls.push(supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl);
      }
    }

    // 3. Décision : source de vérité en base.
    const { data: spotId, error: reviewError } = await supabase.rpc("admin_review_proposal", {
      p_proposal_id: input.proposalId,
      p_decision: input.decision,
      p_internal_note: input.internalNote,
      p_display_precision: input.displayPrecision,
      p_sensitive: input.sensitive,
      p_published_paths: published,
      p_public_urls: publicUrls,
    });
    decided = !reviewError;
    if (reviewError) {
      // Réponse perdue alors que la décision est passée : ne rien supprimer.
      const { data: after } = await supabase.from("proposals").select("state").eq("id", input.proposalId).maybeSingle();
      decided = after?.state === input.decision;
      if (!decided) {
        await removePublished(supabase, published);
        const reason = reviewError.message ?? "";
        if (reason.includes("proposal_already_reviewed")) return { ok: false, reason: "already_reviewed" };
        if (reason.includes("invalid_published_photos")) return { ok: false, reason: "invalid_photo_count" };
        if (reason.includes("forbidden")) return { ok: false, reason: "forbidden" };
        return { ok: false, reason: "decision_failed" };
      }
    }

    // 4. Informations publiques du spot créé.
    let spot: { slug: string; url: string | null; sensitive: boolean } | null = null;
    if (input.decision === "approved") {
      const query = supabase.from("spots").select("slug, publication_state");
      const { data: created } = spotId
        ? await query.eq("id", spotId as string).maybeSingle()
        : { data: null };
      if (created) {
        const sensitive = created.publication_state !== "published";
        spot = {
          slug: created.slug,
          url: sensitive ? null : new URL(`/spots/${created.slug}`, siteUrl()).toString(),
          sensitive,
        };
      }
    }

    // 5. E-mail (sans note interne) ; son échec n'annule jamais la décision.
    let emailSent = false;
    try {
      emailSent = await sendEmail({
        email: proposal.contributor_email,
        trackingId: proposal.tracking_id,
        decision: input.decision,
        spotUrl: spot?.url ?? null,
      });
    } catch {
      emailSent = false;
    }

    // 6. Pages publiques et administration.
    try {
      revalidate("/");
      revalidate("/admin");
      revalidate("/admin/propositions");
      if (spot) revalidate(`/spots/${spot.slug}`);
    } catch {
      // Hors contexte Next (tests) : sans effet sur la décision.
    }

    return { ok: true, decision: input.decision, spot, emailSent };
  } catch {
    if (!decided) await removePublished(supabase, published);
    return { ok: false, reason: "decision_failed" };
  } finally {
    try {
      await supabase.rpc("admin_release_proposal_decision", { p_claim_id: claimId });
    } catch {
      // Verrou expiré automatiquement après 5 minutes.
    }
  }
}
