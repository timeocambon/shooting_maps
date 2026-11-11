// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Administration mobile : chaque endpoint vérifie le jeton (getClaims), puis
 * l'accès en base (admin_mobile_access, avec ce même jeton), et ne lit les
 * données qu'avec ce client. Le client Supabase est simulé ; la clé de
 * service et la session du site ne doivent jamais être utilisées.
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
const sendEmail = vi.fn();
vi.mock("@/features/proposals/server/confirmation-email", () => ({
  sendProposalDecisionEmail: (input: unknown) => sendEmail(input),
}));

const SUPABASE_URL = "https://projet.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const PROPOSAL_ID = "c1111111-1111-4111-8111-111111111111";
const NOW_S = Math.floor(Date.now() / 1000);

type Claims = Record<string, unknown>;
type Fake = {
  claims: Claims | null;
  claimsError: boolean;
  access: { data: unknown; error: unknown };
  queue: unknown[];
  review: Record<string, unknown> | null;
  requestError: { message: string } | null;
  contact: { contributor_email: string; tracking_id: string } | null;
  signed: string[];
  rpcCalls: Array<[string, unknown]>;
  headers: Record<string, string>[];
};
let fake: Fake;

function makeJwt(payload: Claims) {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${enc({ alg: "ES256", typ: "JWT" })}.${enc(payload)}.signature_simulee`;
}

const payload = {
  address: "12 quai de la Daurade",
  latitude: 43.6,
  longitude: 1.44,
  municipality: "Toulouse",
  postalCode: "31000",
  displayPrecision: "exact",
  accessWithoutTrespass: true,
  name: "Quai de la Daurade",
  categories: ["urban"],
  shortDescription: "Un quai pavé au bord de la Garonne, idéal au coucher du soleil.",
  bestTimes: ["sunset"],
  visualFeatures: "Briques roses",
  accessLevel: "easy",
  parking: "Parking moto rue Peyrolières",
  walkingApproach: "Aucune marche",
  surfaceType: "asphalt",
  traffic: "Calme le matin",
  attendance: "variable",
  risks: "Piétons nombreux le week-end, rester au pas.",
  locationStatus: "public",
};

function query(table: string) {
  const state: { single: boolean } = { single: false };
  const builder = {
    select: () => builder,
    in: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: fake.queue, error: null }),
    maybeSingle: () => {
      state.single = true;
      if (table === "proposals" && fake.review) return Promise.resolve({ data: fake.review, error: null });
      if (table === "proposals" && fake.contact) return Promise.resolve({ data: fake.contact, error: null });
      return Promise.resolve({ data: null, error: null });
    },
  };
  return builder;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: { global: { headers: Record<string, string> } }) => {
    fake.headers.push(options.global.headers);
    return {
      auth: {
        getClaims: async () =>
          fake.claimsError || !fake.claims
            ? { data: null, error: { message: "invalid JWT" } }
            : { data: { claims: fake.claims }, error: null },
      },
      rpc: async (name: string, args: unknown) => {
        fake.rpcCalls.push([name, args]);
        if (name === "admin_mobile_access") return fake.access;
        if (name === "admin_request_proposal_changes") return { data: "id", error: fake.requestError };
        return { data: null, error: { message: "inconnue" } };
      },
      from: (table: string) => query(table),
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, ttl: number) => {
            fake.signed.push(`${bucket}:${path}:${ttl}`);
            return {
              data: { signedUrl: `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}?token=t${fake.signed.length}` },
              error: null,
            };
          },
        }),
      },
    };
  },
}));

const { GET: getSession } = await import("@/app/api/admin/mobile/session/route");
const { GET: getQueue } = await import("@/app/api/admin/mobile/proposals/route");
const { GET: getDetail } = await import("@/app/api/admin/mobile/proposals/[id]/route");
const { POST: postRequest } = await import("@/app/api/admin/mobile/proposals/[id]/request-changes/route");

const staffClaims = (aal = "aal2"): Claims => ({ sub: "b2222222-2222-4222-8222-222222222222", role: "authenticated", aal, exp: NOW_S + 3600 });
const token = (claims: Claims = staffClaims()) => makeJwt(claims);
const req = (path: string, init: { token?: string | null; header?: string; body?: unknown; method?: string } = {}) => {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.header !== undefined) headers.authorization = init.header;
  else if (init.token !== null) headers.authorization = `Bearer ${init.token ?? token()}`;
  return new Request(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
};
const params = (id = PROPOSAL_ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  fake = {
    claims: staffClaims(),
    claimsError: false,
    access: { data: "moderator", error: null },
    queue: [],
    review: null,
    requestError: null,
    contact: null,
    signed: [],
    rpcCalls: [],
    headers: [],
  };
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
});

describe("contrôle d'accès (tous les endpoints)", () => {
  it("jeton absent, mal formé ou autre schéma : 401 sans appel à Supabase", async () => {
    for (const header of [undefined, "", "Basic abc", "Bearer ", "Bearer pas-un-jwt", `Bearer ${"a".repeat(9000)}.b.c`]) {
      const response = await getSession(header === undefined ? req("/s", { token: null }) : req("/s", { header }));
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ ok: false, error: "unauthenticated" });
    }
    expect(fake.headers).toHaveLength(0);
  });

  it("jeton invalide (signature refusée) : 401 unauthenticated", async () => {
    fake.claimsError = true;
    const response = await getQueue(req("/q"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthenticated" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("jeton expiré : 401 session_expired, aucune donnée lue", async () => {
    fake.claimsError = true;
    const expired = token({ ...staffClaims(), exp: NOW_S - 10 });
    const response = await getDetail(req("/d", { token: expired }), params());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "session_expired" });
    expect(fake.rpcCalls).toHaveLength(0);
  });

  it("jeton refusé par la base (révoqué ou expiré entre-temps) : 401", async () => {
    fake.access = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
    const response = await getSession(req("/s"));
    expect(response.status).toBe(401);
  });

  it("utilisateur normal : 403 forbidden, aucune lecture", async () => {
    fake.access = { data: "forbidden", error: null };
    for (const call of [
      () => getSession(req("/s")),
      () => getQueue(req("/q")),
      () => getDetail(req("/d"), params()),
      () => postRequest(req("/r", { method: "POST", body: { publicMessage: "Précise l'accès" } }), params()),
    ]) {
      const response = await call();
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ error: "forbidden" });
    }
    expect(fake.rpcCalls.every(([name]) => name === "admin_mobile_access")).toBe(true);
    expect(fake.signed).toHaveLength(0);
  });

  it("modérateur AAL1 : 403 mfa_required", async () => {
    fake.claims = staffClaims("aal1");
    fake.access = { data: "mfa_required", error: null };
    const response = await getQueue(req("/q"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
  });

  it("double contrôle : base OK mais jeton vérifié en AAL1 → 403 mfa_required", async () => {
    fake.claims = staffClaims("aal1");
    const response = await getSession(req("/s"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
  });

  it("jeton d'un autre rôle (anon, service) : 401", async () => {
    fake.claims = { ...staffClaims(), role: "service_role" };
    expect((await getSession(req("/s"))).status).toBe(401);
    fake.claims = { role: "anon", aal: "aal1", exp: NOW_S + 60 };
    expect((await getSession(req("/s"))).status).toBe(401);
  });

  it("limitation de fréquence : 429 ; lecture et écriture comptées à part", async () => {
    fake.access = { data: "rate_limit", error: null };
    const response = await getQueue(req("/q"));
    expect(response.status).toBe(429);
    await postRequest(req("/r", { method: "POST", body: { publicMessage: "x" } }), params());
    expect(fake.rpcCalls.map(([, args]) => args)).toEqual([{ p_action: "read" }, { p_action: "write" }]);
  });

  it("erreur de la base : 503 sans détail", async () => {
    fake.access = { data: null, error: { code: "XX000", message: "connexion perdue" } };
    const response = await getSession(req("/s"));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("connexion perdue");
  });

  it("modérateur AAL2 : autorisé, jeton transmis à Supabase, réponse non mise en cache", async () => {
    const t = token();
    const response = await getSession(req("/s", { token: t }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, access: "granted", role: "moderator" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fake.headers[0]).toEqual({ Authorization: `Bearer ${t}` });
  });
});

describe("GET /api/admin/mobile/proposals", () => {
  it("file sans e-mail : réponses reçues d'abord", async () => {
    fake.queue = [
      { id: "a", tracking_id: "SPT-AAAAAAAAAA", contributor_email: "x@y.fr", state: "submitted", submitted_at: "2026-11-01T10:00:00Z", payload, proposal_photos: [{ count: 3 }], proposal_change_requests: [] },
      { id: "b", tracking_id: "SPT-BBBBBBBBBB", contributor_email: "x@y.fr", state: "changes_requested", submitted_at: "2026-11-02T10:00:00Z", payload, proposal_photos: [{ count: 2 }], proposal_change_requests: [{ requested_at: "2026-11-03T10:00:00Z", responded_at: null }] },
      { id: "c", tracking_id: "SPT-CCCCCCCCCC", contributor_email: "x@y.fr", state: "submitted", submitted_at: "2026-11-03T10:00:00Z", payload, proposal_photos: [{ count: 2 }], proposal_change_requests: [{ requested_at: "2026-11-04T10:00:00Z", responded_at: "2026-11-05T10:00:00Z" }] },
    ];
    const response = await getQueue(req("/q"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { id: string }) => item.id)).toEqual(["c", "a", "b"]);
    expect(body.items[0]).toEqual({
      id: "c", trackingId: "SPT-CCCCCCCCCC", name: "Quai de la Daurade", municipality: "Toulouse",
      state: "submitted", submittedAt: "2026-11-03T10:00:00Z", photoCount: 2, hasNewResponse: true,
    });
    expect(JSON.stringify(body)).not.toContain("@");
  });
});

describe("GET /api/admin/mobile/proposals/[id]", () => {
  const review = () => ({
    id: PROPOSAL_ID,
    tracking_id: "SPT-ECHANGE001",
    contributor_email: "rider@example.com",
    public_pseudonym: "Rider31",
    state: "submitted",
    submitted_at: "2026-11-01T10:00:00Z",
    payload,
    moderation_comment: "NOTE-EQUIPE",
    proposal_photos: [
      { id: "p2", display_order: 1, credit: null, width: 1600, height: 1067, byte_size: 1, processed_object_path: "proposals/x/processed-1-b.webp", moderation_state: "pending" },
      { id: "p1", display_order: 0, credit: "Moi", width: 1067, height: 1600, byte_size: 1, processed_object_path: "proposals/x/processed-0-a.webp", moderation_state: "pending" },
      { id: "p3", display_order: 2, credit: null, width: 1, height: 1, byte_size: 1, processed_object_path: null, moderation_state: "pending" },
    ],
    proposal_change_requests: [
      { id: "r1", public_message: "Précise l'accès", requested_at: "2026-11-02T10:00:00Z", response: "Par la rue", responded_at: "2026-11-03T10:00:00Z", closed_at: "2026-11-03T10:00:00Z" },
    ],
  });

  it("fiche : photos signées 10 minutes (versions traitées), note interne, échanges, sans e-mail ni chemin", async () => {
    fake.review = review();
    const response = await getDetail(req("/d"), params());
    expect(response.status).toBe(200);
    const { proposal } = await response.json();
    expect(fake.signed).toEqual([
      "spot-originals:proposals/x/processed-0-a.webp:600",
      "spot-originals:proposals/x/processed-1-b.webp:600",
    ]);
    expect(proposal.photos.map((p: { id: string }) => p.id)).toEqual(["p1", "p2"]);
    for (const photo of proposal.photos) {
      expect(photo.url).toMatch(/^https:\/\/projet\.supabase\.co\/storage\/v1\/object\/sign\/.+\?token=/);
      expect(Date.parse(photo.expiresAt) - Date.now()).toBeGreaterThan(9 * 60 * 1000);
      expect(Object.keys(photo).sort()).toEqual(["credit", "expiresAt", "height", "id", "url", "width"]);
    }
    expect(proposal.spot).toEqual(payload);
    expect(proposal.internalNote).toBe("NOTE-EQUIPE");
    expect(proposal.exchanges).toHaveLength(1);
    expect(proposal.hasNewResponse).toBe(true);
    expect(proposal.canRequestChanges).toBe(true);
    const text = JSON.stringify(proposal);
    expect(text).not.toContain("rider@example.com");
    expect(text).not.toContain("original_object_path");
    expect(text).not.toContain("/original-");
    expect(text).not.toContain("processed_object_path");
  });

  it("identifiant invalide ou proposition invisible : 404", async () => {
    expect((await getDetail(req("/d"), params("pas-un-uuid"))).status).toBe(404);
    fake.review = null;
    expect((await getDetail(req("/d"), params())).status).toBe(404);
  });
});

describe("POST /api/admin/mobile/proposals/[id]/request-changes", () => {
  const post = (body: unknown, id?: string) => postRequest(req("/r", { method: "POST", body }), params(id));

  it("enregistre la demande publique ; l'e-mail ne reçoit jamais la note interne", async () => {
    fake.contact = { contributor_email: "rider@example.com", tracking_id: "SPT-ECHANGE001" };
    const response = await post({ publicMessage: "  Peux-tu préciser l'accès ?  ", internalNote: " NOTE-SECRETE " });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, state: "changes_requested", emailSent: true });
    expect(fake.rpcCalls[1]).toEqual([
      "admin_request_proposal_changes",
      { p_proposal_id: PROPOSAL_ID, p_public_message: "Peux-tu préciser l'accès ?", p_internal_note: "NOTE-SECRETE" },
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sendEmail.mock.calls[0][0])).not.toContain("NOTE-SECRETE");
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ decision: "changes_requested", publicMessage: "Peux-tu préciser l'accès ?" });
  });

  it("double envoi : la seconde demande est refusée (409) sans e-mail", async () => {
    fake.requestError = { message: "request_already_open" };
    const response = await post({ publicMessage: "Encore" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "already_reviewed" });
    expect(sendEmail).not.toHaveBeenCalled();
    fake.requestError = { message: "proposal_already_reviewed" };
    expect((await post({ publicMessage: "Encore" })).status).toBe(409);
  });

  it("validation : message obligatoire (1–2000), note ≤ 2000, corps strict", async () => {
    const cases: Array<[unknown, string]> = [
      [{ publicMessage: "   " }, "invalid_message"],
      [{ publicMessage: "x".repeat(2001) }, "invalid_message"],
      [{ publicMessage: "ok", internalNote: "y".repeat(2001) }, "invalid_note"],
      [{ publicMessage: "ok", role: "administrator" }, "invalid_request"],
      [{}, "invalid_request"],
      ["{pas du json", "invalid_request"],
    ];
    for (const [body, error] of cases) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error });
    }
    expect(fake.rpcCalls.filter(([name]) => name === "admin_request_proposal_changes")).toHaveLength(0);
    expect((await post({ publicMessage: "ok" }, "123")).status).toBe(404);
  });

  it("erreur inattendue de la base : 503", async () => {
    fake.requestError = { message: "deadlock detected" };
    expect((await post({ publicMessage: "ok" })).status).toBe(503);
  });
});
