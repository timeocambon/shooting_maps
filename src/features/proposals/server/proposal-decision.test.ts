// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/proposals/server/confirmation-email", async () => {
  const actual = await vi.importActual<object>("@/features/proposals/server/confirmation-email");
  return { ...actual, sendProposalDecisionEmail: vi.fn() };
});

const { decideProposal, isProcessedPath, isWebp, publishedPhotoPath } = await import(
  "@/features/proposals/server/proposal-decision"
);
const { buildProposalDecisionEmail } = await import("@/features/proposals/server/confirmation-email");

const ID = "c1111111-1111-4111-8111-111111111111";
const SECRET = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 9, 9]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const processed = (i: number) => `proposals/${ID}/${SECRET}/processed-${i}-${String(i).padStart(8, "0")}-1111-4111-8111-111111111111.webp`;
const original = (i: number) => `proposals/${ID}/${SECRET}/original-${i}-${String(i).padStart(8, "0")}-1111-4111-8111-111111111111.jpg`;

type Photo = { processed_object_path: string | null; display_order: number; moderation_state: string };
type World = {
  state: string;
  photos: Photo[];
  claim: "claimed" | "busy" | "changed" | "already_reviewed" | "error";
  files: Map<string, Uint8Array>;
  published: Map<string, Uint8Array>;
  failDownloadAt: number | null;
  failUploadAt: number | null;
  reviewError: string | null;
  reviewApplies: boolean;
  spot: { slug: string; publication_state: string } | null;
  calls: string[];
  reviewArgs: Record<string, unknown> | null;
  released: string[];
  downloads: string[];
};
let w: World;

function photos(n: number): Photo[] {
  // Ordre volontairement mélangé : le module doit trier par display_order.
  return Array.from({ length: n }, (_, i) => ({ processed_object_path: processed(i), display_order: i, moderation_state: "pending" })).reverse();
}

function client() {
  let downloads = 0;
  let uploads = 0;
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      w.calls.push(name);
      if (name === "admin_claim_proposal_decision") {
        if (w.claim === "error") return { data: null, error: { message: "boom" } };
        return { data: w.claim === "claimed" ? { status: "claimed", claim_id: "claim-1" } : { status: w.claim }, error: null };
      }
      if (name === "admin_release_proposal_decision") {
        w.released.push(args.p_claim_id as string);
        return { data: null, error: null };
      }
      if (name === "admin_review_proposal") {
        w.reviewArgs = args;
        if (w.reviewError) {
          if (w.reviewApplies) w.state = args.p_decision as string;
          return { data: null, error: { message: w.reviewError } };
        }
        if (w.state !== "submitted") return { data: null, error: { message: "proposal_already_reviewed" } };
        w.state = args.p_decision as string;
        return { data: args.p_decision === "approved" ? "spot-uuid" : null, error: null };
      }
      return { data: null, error: { message: "inconnue" } };
    },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === "proposals") {
            return { data: { id: ID, state: w.state, tracking_id: "SPT-DECISION01", contributor_email: "rider@example.com", proposal_photos: w.photos }, error: null };
          }
          if (table === "spots") return { data: w.spot, error: null };
          return { data: null, error: null };
        },
      };
      return builder;
    },
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          w.downloads.push(`${bucket}:${path}`);
          if (w.failDownloadAt === downloads++) return { data: null, error: { message: "download" } };
          const bytes = bucket === "spot-originals" ? w.files.get(path) : undefined;
          return bytes ? { data: new Blob([new Uint8Array(bytes)]), error: null } : { data: null, error: { message: "absent" } };
        },
        upload: async (path: string, bytes: Uint8Array, options: { contentType: string }) => {
          if (bucket !== "spot-published") throw new Error("écriture hors du bucket public");
          expect(options.contentType).toBe("image/webp");
          if (w.failUploadAt === uploads++) return { data: null, error: { message: "upload" } };
          w.published.set(path, bytes);
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const path of paths) w.published.delete(path);
          return { data: [], error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://projet.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
      }),
    },
  } as never;
}

const sendEmail = vi.fn();
const revalidate = vi.fn();
const deps = () => ({ sendEmail, revalidate, siteUrl: () => "https://www.spot-ride.fr" });
const input = (extra: Record<string, unknown> = {}) => ({
  proposalId: ID,
  decision: "approved" as const,
  internalNote: "NOTE-PRIVEE",
  displayPrecision: "exact" as const,
  sensitive: false,
  ...extra,
});

beforeEach(() => {
  w = {
    state: "submitted",
    photos: photos(2),
    claim: "claimed",
    files: new Map(Array.from({ length: 6 }, (_, i) => [processed(i), WEBP] as const).concat(Array.from({ length: 6 }, (_, i) => [original(i), JPEG] as const))),
    published: new Map(),
    failDownloadAt: null,
    failUploadAt: null,
    reviewError: null,
    reviewApplies: false,
    spot: { slug: "quai-de-la-daurade-decision01", publication_state: "published" },
    calls: [],
    reviewArgs: null,
    released: [],
    downloads: [],
  };
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  revalidate.mockReset();
});

describe("publication", () => {
  it.each([2, 6])("publie %i photos traitées, dans l'ordre, puis appelle admin_review_proposal une seule fois", async (count) => {
    w.photos = photos(count);
    const result = await decideProposal(client(), input(), deps());
    expect(result).toEqual({
      ok: true,
      decision: "approved",
      spot: { slug: "quai-de-la-daurade-decision01", url: "https://www.spot-ride.fr/spots/quai-de-la-daurade-decision01", sensitive: false },
      emailSent: true,
    });
    const expected = Array.from({ length: count }, (_, i) => publishedPhotoPath(ID, i));
    expect([...w.published.keys()]).toEqual(expected);
    expect(w.reviewArgs?.p_published_paths).toEqual(expected);
    expect((w.reviewArgs?.p_public_urls as string[])[0]).toBe(`https://projet.supabase.co/storage/v1/object/public/spot-published/spots/${ID}/01.webp`);
    // Ordre conservé : la photo 01 publique vient de la photo d'ordre 0.
    expect(w.downloads).toEqual(Array.from({ length: count }, (_, i) => `spot-originals:${processed(i)}`));
    expect(w.calls.filter((name) => name === "admin_review_proposal")).toHaveLength(1);
    expect(w.released).toEqual(["claim-1"]);
    expect(revalidate).toHaveBeenCalledWith("/");
    expect(revalidate).toHaveBeenCalledWith("/spots/quai-de-la-daurade-decision01");
  });

  it("n'utilise jamais un original : seuls les WebP traités sont lus et publiés", async () => {
    await decideProposal(client(), input(), deps());
    expect(w.downloads.every((entry) => entry.includes("/processed-"))).toBe(true);
    for (const bytes of w.published.values()) expect(isWebp(bytes)).toBe(true);
    expect([...w.published.keys()].every((path) => /^spots\/[0-9a-f-]{36}\/0[1-6]\.webp$/.test(path))).toBe(true);
  });

  it("refuse un chemin qui n'est pas une version traitée de cette proposition", async () => {
    w.photos = [
      { processed_object_path: processed(0), display_order: 0, moderation_state: "pending" },
      { processed_object_path: original(1), display_order: 1, moderation_state: "pending" },
    ];
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "photo_download_failed" });
    expect(w.published.size).toBe(0);
    expect(w.downloads).toHaveLength(0);
    expect(isProcessedPath(processed(0), "d1111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("refuse un fichier traité qui n'est pas un WebP, et nettoie", async () => {
    w.files.set(processed(1), JPEG);
    w.photos = photos(3);
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "photo_download_failed" });
    expect(w.published.size).toBe(0);
  });

  it.each([[1], [7]])("refuse %i photo(s) sans rien publier", async (count) => {
    w.photos = Array.from({ length: count }, (_, i) => ({ processed_object_path: processed(i % 6), display_order: i, moderation_state: "pending" }));
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "invalid_photo_count" });
    expect(w.published.size).toBe(0);
    expect(w.calls).not.toContain("admin_review_proposal");
    expect(w.released).toEqual(["claim-1"]);
  });

  it("ignore les photos rejetées ou non traitées pour le compte (comme admin_review_proposal)", async () => {
    w.photos = [...photos(2), { processed_object_path: processed(5), display_order: 9, moderation_state: "rejected" }, { processed_object_path: null, display_order: 10, moderation_state: "pending" }];
    expect((await decideProposal(client(), input(), deps())).ok).toBe(true);
    expect(w.published.size).toBe(2);
  });

  it("échec de téléchargement au milieu : copies déjà publiées supprimées", async () => {
    w.photos = photos(4);
    w.failDownloadAt = 2;
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "photo_download_failed" });
    expect(w.published.size).toBe(0);
    expect(w.calls).not.toContain("admin_review_proposal");
  });

  it("échec de publication au milieu : copies déjà publiées supprimées", async () => {
    w.photos = photos(5);
    w.failUploadAt = 3;
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "photo_publish_failed" });
    expect(w.published.size).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("admin_review_proposal refuse : copies publiques supprimées, aucun e-mail", async () => {
    w.reviewError = "invalid_published_photos";
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "invalid_photo_count" });
    expect(w.published.size).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    w.reviewError = "deadlock detected";
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "decision_failed" });
    expect(w.published.size).toBe(0);
  });

  it("réponse perdue alors que la décision est passée : rien n'est supprimé", async () => {
    w.reviewError = "connexion interrompue";
    w.reviewApplies = true;
    const result = await decideProposal(client(), input(), deps());
    expect(result.ok).toBe(true);
    expect(w.published.size).toBe(2);
  });

  it("lieu sensible : pas de lien public renvoyé ni envoyé", async () => {
    w.spot = { slug: "lieu-sensible-decision01", publication_state: "sensitive" };
    const result = await decideProposal(client(), input({ sensitive: true }), deps());
    expect(result).toMatchObject({ ok: true, spot: { slug: "lieu-sensible-decision01", url: null, sensitive: true } });
    expect(sendEmail.mock.calls[0][0].spotUrl).toBeNull();
    expect(w.reviewArgs?.p_sensitive).toBe(true);
  });
});

describe("doubles décisions", () => {
  it("double appui ou second modérateur : 'decision_in_progress' sans aucune écriture", async () => {
    w.claim = "busy";
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "decision_in_progress" });
    expect(w.calls).toEqual(["admin_claim_proposal_decision"]);
    expect(w.published.size).toBe(0);
  });

  it("proposition déjà traitée : 'already_reviewed', aucun deuxième spot", async () => {
    expect((await decideProposal(client(), input(), deps())).ok).toBe(true);
    w.claim = "already_reviewed";
    w.published.clear();
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "already_reviewed" });
    expect(w.calls.filter((name) => name === "admin_review_proposal")).toHaveLength(1);
    expect(w.published.size).toBe(0);
  });

  it("décision concurrente passée entre le verrou et la décision : 409 et nettoyage", async () => {
    w.reviewError = "proposal_already_reviewed";
    expect(await decideProposal(client(), input(), deps())).toEqual({ ok: false, reason: "already_reviewed" });
    expect(w.published.size).toBe(0);
  });

  it("état relu en base : la proposition n'est plus en vérification", async () => {
    w.state = "changes_requested";
    expect(await decideProposal(client(), input({ decision: "rejected" }), deps())).toEqual({ ok: false, reason: "already_reviewed" });
    expect(w.calls).not.toContain("admin_review_proposal");
  });

  it("fiche obsolète : version transmise au verrou, 'proposal_changed'", async () => {
    w.claim = "changed";
    expect(await decideProposal(client(), input({ expectedVersion: "2026-11-12T10:00:00.123456+00:00" }), deps())).toEqual({ ok: false, reason: "proposal_changed" });
  });

  it("verrou refusé par la base (droits) : forbidden", async () => {
    const forbidden = client() as unknown as { rpc: (n: string) => Promise<unknown> };
    forbidden.rpc = async () => ({ data: null, error: { message: "forbidden" } });
    expect(await decideProposal(forbidden as never, input(), deps())).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("refus et doublon", () => {
  it.each(["rejected", "duplicate"] as const)("%s : enregistré, note conservée en base, jamais dans l'e-mail ; photos intactes", async (decision) => {
    const result = await decideProposal(client(), input({ decision }), deps());
    expect(result).toEqual({ ok: true, decision, spot: null, emailSent: true });
    expect(w.reviewArgs).toMatchObject({ p_decision: decision, p_internal_note: "NOTE-PRIVEE", p_published_paths: [], p_public_urls: [] });
    expect(w.downloads).toHaveLength(0);
    expect(w.published.size).toBe(0);
    const email = sendEmail.mock.calls[0][0];
    expect(email).toEqual({ email: "rider@example.com", trackingId: "SPT-DECISION01", decision, spotUrl: null });
    expect(JSON.stringify(email)).not.toContain("NOTE-PRIVEE");
  });

  it("échec de l'e-mail : décision conservée, emailSent=false", async () => {
    sendEmail.mockResolvedValue(false);
    expect(await decideProposal(client(), input({ decision: "rejected" }), deps())).toMatchObject({ ok: true, emailSent: false });
    sendEmail.mockRejectedValue(new Error("brevo"));
    w.state = "submitted";
    expect(await decideProposal(client(), input({ decision: "duplicate" }), deps())).toMatchObject({ ok: true, emailSent: false });
    expect(w.state).toBe("duplicate");
  });
});

describe("e-mails de décision", () => {
  const siteUrl = "https://www.spot-ride.fr";
  it("publication : confirme la publication, lien vers le spot", () => {
    const email = buildProposalDecisionEmail({ trackingId: "SPT-DECISION01", decision: "approved", siteUrl, spotUrl: "https://www.spot-ride.fr/spots/quai" });
    expect(email.subject).toBe("Votre proposition SPT-DECISION01 est publiée");
    expect(email.html).toContain("publiée sur Spotride");
    expect(email.html).toContain('href="https://www.spot-ride.fr/spots/quai"');
  });
  it("refus : neutre", () => {
    const email = buildProposalDecisionEmail({ trackingId: "SPT-DECISION01", decision: "rejected", siteUrl });
    expect(email.subject).toBe("Décision concernant SPT-DECISION01");
    expect(email.html).toContain("ne peut pas être publiée dans son état actuel");
  });
  it("doublon : un spot similaire existe déjà", () => {
    const email = buildProposalDecisionEmail({ trackingId: "SPT-DECISION01", decision: "duplicate", siteUrl });
    expect(email.html).toContain("Un spot similaire existe déjà");
  });
  it("aucune donnée technique ni privée dans les e-mails", () => {
    for (const decision of ["approved", "rejected", "duplicate"] as const) {
      const email = buildProposalDecisionEmail({ trackingId: "SPT-DECISION01", decision, siteUrl });
      const text = email.subject + email.html;
      expect(text).not.toMatch(/NOTE|proposals\/|spot-originals|uuid|supabase|service_role/i);
    }
  });
});
