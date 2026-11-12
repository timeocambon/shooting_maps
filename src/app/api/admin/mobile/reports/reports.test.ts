// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/admin/mobile/reports et /reports/{id} : mêmes contrôles que les
 * autres endpoints mobiles (jeton vérifié, équipe, AAL2, limitation), lecture
 * avec le client lié au jeton, réponses sans données privées.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service-role-server", () => ({
  isServiceRoleConfigured: () => {
    throw new Error("clé de service interdite ici");
  },
  createSupabaseServiceRoleClient: () => {
    throw new Error("clé de service interdite ici");
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => {
    throw new Error("session du site interdite ici");
  },
}));

const SUPABASE_URL = "https://projet.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const REPORT_ID = "e1111111-1111-4111-8111-111111111111";
const SPOT_ID = "a1111111-1111-4111-8111-111111111111";
const NOW_S = Math.floor(Date.now() / 1000);

type World = {
  claims: Record<string, unknown> | null;
  access: { data: unknown; error: unknown };
  list: unknown[];
  listError: unknown;
  review: Record<string, unknown> | null;
  queries: Array<{ table: string; select: string; filters: unknown[] }>;
  rpc: unknown[];
};
let w: World;

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => (w.claims ? { data: { claims: w.claims }, error: null } : { data: null, error: { message: "invalid JWT" } }),
    },
    rpc: async (name: string, args: unknown) => {
      w.rpc.push([name, args]);
      if (name === "admin_mobile_access") return w.access;
      throw new Error(`appel inattendu : ${name}`);
    },
    from: (table: string) => {
      const query = { table, select: "", filters: [] as unknown[] };
      w.queries.push(query);
      const builder = {
        select: (fields: string) => {
          query.select = fields;
          return builder;
        },
        in: (...args: unknown[]) => {
          query.filters.push(["in", ...args]);
          return builder;
        },
        eq: (...args: unknown[]) => {
          query.filters.push(["eq", ...args]);
          return builder;
        },
        order: (...args: unknown[]) => {
          query.filters.push(["order", ...args]);
          return builder;
        },
        maybeSingle: async () => ({ data: w.review, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: w.list, error: w.listError }),
      };
      return builder;
    },
  }),
}));

const { GET: getList } = await import("@/app/api/admin/mobile/reports/route");
const { GET: getDetail } = await import("@/app/api/admin/mobile/reports/[id]/route");

const jwt = (payload: Record<string, unknown>) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${enc({ alg: "ES256" })}.${enc(payload)}.sig`;
};
const staff = (aal = "aal2") => ({ sub: "b2222222-2222-4222-8222-222222222222", role: "authenticated", aal, exp: NOW_S + 3600 });
const req = (token: string | null = jwt(staff())) =>
  new Request("http://localhost/api/admin/mobile/reports", { headers: token ? { authorization: `Bearer ${token}` } : {} });
const params = (id = REPORT_ID) => ({ params: Promise.resolve({ id }) });

const spot = (extra: Record<string, unknown> = {}) => ({ id: SPOT_ID, name: "Quai de la Daurade", slug: "quai-de-la-daurade", municipality: "Toulouse", publication_state: "published", ...extra });
const row = (id: string, priority: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id, reason: "access_forbidden", priority, state: "open", comment: "Le portail est désormais fermé à clé.", created_at: createdAt,
  reporter_email: "temoin@example.com", decision: "NOTE-DECISION", internal_note: "NOTE-INTERNE", handled_by: "b2222222-2222-4222-8222-222222222222",
  spots: spot(), ...extra,
});
const reviewRow = (spotsValue: unknown = {
  ...spot(),
  spot_categories: [{ categories: { label: "Urbain" } }, { categories: [{ label: "Panorama" }] }, { categories: null }],
  spot_photos: [
    { public_url: `${SUPABASE_URL}/storage/v1/object/public/spot-published/spots/x/02.webp`, alt_text: "Deuxième", credit: null, display_order: 1, moderation_state: "approved", removed_at: null },
    { public_url: `${SUPABASE_URL}/storage/v1/object/public/spot-published/spots/x/01.webp`, alt_text: "Quai au coucher du soleil", credit: "Rider31", display_order: 0, moderation_state: "approved", removed_at: null },
    { public_url: `${SUPABASE_URL}/storage/v1/object/public/spot-published/spots/x/00.webp`, alt_text: "Masquée", credit: null, display_order: 0, moderation_state: "hidden", removed_at: null },
  ],
}) => ({ ...row(REPORT_ID, "high", "2026-11-10T08:00:00Z"), spots: spotsValue });

beforeEach(() => {
  w = { claims: staff(), access: { data: "moderator", error: null }, list: [], listError: null, review: null, queries: [], rpc: [] };
});

describe("contrôle d'accès (liste et détail)", () => {
  const both = [() => getList(req()), () => getDetail(req(), params())] as const;

  it("sans jeton : 401, aucune lecture", async () => {
    for (const call of [() => getList(req(null)), () => getDetail(req(null), params())]) {
      const response = await call();
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ ok: false, error: "unauthenticated" });
    }
    expect(w.queries).toHaveLength(0);
  });

  it("jeton invalide : 401 ; jeton expiré : 401 session_expired", async () => {
    w.claims = null;
    expect((await getList(req())).status).toBe(401);
    const expired = await getDetail(req(jwt({ ...staff(), exp: NOW_S - 5 })), params());
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ error: "session_expired" });
    expect(w.queries).toHaveLength(0);
  });

  it("utilisateur normal : 403 forbidden, aucune lecture", async () => {
    w.access = { data: "forbidden", error: null };
    for (const call of both) {
      const response = await call();
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: "forbidden" });
    }
    expect(w.queries).toHaveLength(0);
  });

  it("membre de l'équipe en AAL1 : 403 mfa_required", async () => {
    w.claims = staff("aal1");
    w.access = { data: "mfa_required", error: null };
    for (const call of both) {
      const response = await call();
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: "mfa_required" });
    }
    expect(w.queries).toHaveLength(0);
  });

  it("limitation de débit : 429, contrôle de lecture", async () => {
    w.access = { data: "rate_limit", error: null };
    expect((await getList(req())).status).toBe(429);
    expect((await getDetail(req(), params())).status).toBe(429);
    expect(w.rpc).toEqual([["admin_mobile_access", { p_action: "read" }], ["admin_mobile_access", { p_action: "read" }]]);
  });

  it("membre de l'équipe en AAL2 : autorisé, réponse non mise en cache", async () => {
    const response = await getList(req());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Authorization");
  });
});

describe("GET /api/admin/mobile/reports", () => {
  it("liste vide", async () => {
    const response = await getList(req());
    expect(await response.json()).toEqual({ ok: true, items: [], count: 0, highPriorityCount: 0 });
    expect(w.queries[0].filters).toContainEqual(["in", "state", ["open", "in_review"]]);
  });

  it("tri : priorité haute d'abord, puis les plus anciens ; sans e-mail ni note", async () => {
    w.list = [
      row("r-normal-recent", "normal", "2026-11-11T10:00:00Z"),
      row("r-high-recent", "high", "2026-11-11T09:00:00Z"),
      row("r-normal-ancien", "normal", "2026-11-01T10:00:00Z"),
      row("r-high-ancien", "high", "2026-11-02T10:00:00Z"),
      row("r-sans-spot", "high", "2026-10-01T10:00:00Z", { spots: null }),
    ];
    const response = await getList(req());
    const body = await response.json();
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["r-high-ancien", "r-high-recent", "r-normal-ancien", "r-normal-recent"]);
    expect(body.count).toBe(4);
    expect(body.highPriorityCount).toBe(2);
    expect(body.items[0]).toEqual({
      id: "r-high-ancien",
      priority: "high",
      isHighPriority: true,
      reason: "access_forbidden",
      reasonLabel: "Accès désormais interdit",
      state: "open",
      stateLabel: "Ouvert",
      createdAt: "2026-11-02T10:00:00Z",
      spot: { id: SPOT_ID, name: "Quai de la Daurade", slug: "quai-de-la-daurade" },
    });
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/temoin@example\.com|NOTE-|b2222222|portail est désormais/);
  });

  it("erreur de lecture : 503 neutre", async () => {
    w.listError = { message: "relation \"reports\" does not exist", code: "42P01" };
    const response = await getList(req());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/relation|42P01|reports/);
  });
});

describe("GET /api/admin/mobile/reports/{id}", () => {
  it("détail : message complet, spot public, catégories, photo publique ; aucune donnée privée", async () => {
    w.review = reviewRow();
    const response = await getDetail(req(), params());
    expect(response.status).toBe(200);
    const { report } = await response.json();
    expect(report).toEqual({
      id: REPORT_ID,
      priority: "high",
      isHighPriority: true,
      reason: "access_forbidden",
      reasonLabel: "Accès désormais interdit",
      state: "open",
      stateLabel: "Ouvert",
      createdAt: "2026-11-10T08:00:00Z",
      message: "Le portail est désormais fermé à clé.",
      spot: {
        id: SPOT_ID,
        name: "Quai de la Daurade",
        slug: "quai-de-la-daurade",
        municipality: "Toulouse",
        categories: ["Urbain", "Panorama"],
        publicationState: "published",
        publicationStateLabel: "Publié",
        isPublic: true,
        publicPath: "/spots/quai-de-la-daurade",
        photo: { url: `${SUPABASE_URL}/storage/v1/object/public/spot-published/spots/x/01.webp`, alt: "Quai au coucher du soleil", credit: "Rider31" },
      },
    });
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/temoin@example\.com|NOTE-|b2222222|original|spot-originals|token=/);
    expect(w.queries[0].select).not.toContain("original_object_path");
  });

  it("spot non public : pas de chemin public ; photo hors bucket public ignorée", async () => {
    w.review = reviewRow({
      ...spot({ publication_state: "hidden" }),
      spot_categories: [],
      spot_photos: [{ public_url: `${SUPABASE_URL}/storage/v1/object/sign/spot-originals/x.jpg?token=abc`, alt_text: null, credit: null, display_order: 0, moderation_state: "approved", removed_at: null }],
    });
    const { report } = await (await getDetail(req(), params())).json();
    expect(report.spot).toMatchObject({ publicationState: "hidden", publicationStateLabel: "Masqué", isPublic: false, publicPath: null, photo: null, categories: [] });
  });

  it("signalement introuvable ou identifiant invalide : 404 neutre", async () => {
    for (const response of [await getDetail(req(), params()), await getDetail(req(), params("123"))]) {
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ ok: false, error: "not_found", message: "Signalement introuvable." });
    }
  });

  it("spot supprimé : 404 spot_not_found", async () => {
    w.review = reviewRow(null);
    const response = await getDetail(req(), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "spot_not_found", message: "Le spot concerné n’existe plus." });
  });
});
