// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/admin/mobile/proposals/{id}/decision : contrôle d'accès complet
 * (jeton, équipe, AAL2, limitation), corps strict, puis `decideProposal`
 * (testée à part) appelée avec le client lié au jeton.
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
const decideProposal = vi.fn();
vi.mock("@/features/proposals/server/proposal-decision", () => ({
  decideProposal: (...args: unknown[]) => decideProposal(...args),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const ID = "c1111111-1111-4111-8111-111111111111";
const NOW_S = Math.floor(Date.now() / 1000);
let claims: Record<string, unknown> | null;
let access: { data: unknown; error: unknown };
const accessCalls: unknown[] = [];
const clients: object[] = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => {
    const client = {
      auth: {
        getClaims: async () => (claims ? { data: { claims }, error: null } : { data: null, error: { message: "invalid" } }),
      },
      rpc: async (name: string, args: unknown) => {
        if (name === "admin_mobile_access") {
          accessCalls.push(args);
          return access;
        }
        throw new Error(`appel inattendu : ${name}`);
      },
    };
    clients.push(client);
    return client;
  },
}));

const { POST } = await import("@/app/api/admin/mobile/proposals/[id]/decision/route");

const jwt = (payload: Record<string, unknown>) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${enc({ alg: "ES256" })}.${enc(payload)}.sig`;
};
const staff = (aal = "aal2") => ({ sub: "b2222222-2222-4222-8222-222222222222", role: "authenticated", aal, exp: NOW_S + 3600 });
const post = (body: unknown, { token = jwt(staff()), id = ID }: { token?: string | null; id?: string } = {}) =>
  POST(
    new Request(`http://localhost/api/admin/mobile/proposals/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const approve = { decision: "approved", internalNote: "Vérifications effectuées", displayPrecision: "exact", sensitive: false };

beforeEach(() => {
  claims = staff();
  access = { data: "moderator", error: null };
  accessCalls.length = 0;
  clients.length = 0;
  decideProposal.mockReset();
  decideProposal.mockResolvedValue({ ok: true, decision: "approved", spot: { slug: "quai-abc", url: "https://www.spot-ride.fr/spots/quai-abc", sensitive: false }, emailSent: true });
});

describe("accès", () => {
  it("sans jeton : 401, aucune décision", async () => {
    const response = await post(approve, { token: null });
    expect(response.status).toBe(401);
    expect(decideProposal).not.toHaveBeenCalled();
  });

  it("jeton invalide : 401 ; jeton expiré : 401 session_expired", async () => {
    claims = null;
    expect((await post(approve)).status).toBe(401);
    const expired = await post(approve, { token: jwt({ ...staff(), exp: NOW_S - 5 }) });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ error: "session_expired" });
    expect(decideProposal).not.toHaveBeenCalled();
  });

  it("utilisateur normal : 403 ; modérateur AAL1 : 403 mfa_required", async () => {
    access = { data: "forbidden", error: null };
    expect((await post(approve)).status).toBe(403);
    access = { data: "mfa_required", error: null };
    claims = staff("aal1");
    const response = await post(approve);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
    expect(decideProposal).not.toHaveBeenCalled();
  });

  it("limitation des écritures : contrôle 'write', 429 si dépassée", async () => {
    access = { data: "rate_limit", error: null };
    expect((await post(approve)).status).toBe(429);
    expect(accessCalls).toEqual([{ p_action: "write" }]);
  });

  it("modérateur AAL2 : décision avec le client lié au jeton", async () => {
    const response = await post({ ...approve, version: "2026-11-12T10:00:00.123456+00:00" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      decision: "approved",
      state: "approved",
      spot: { slug: "quai-abc", url: "https://www.spot-ride.fr/spots/quai-abc", sensitive: false },
      emailSent: true,
    });
    expect(decideProposal).toHaveBeenCalledWith(clients[0], {
      proposalId: ID,
      decision: "approved",
      internalNote: "Vérifications effectuées",
      displayPrecision: "exact",
      sensitive: false,
      expectedVersion: "2026-11-12T10:00:00.123456+00:00",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("corps strict", () => {
  it.each([
    [{ ...approve, role: "administrator" }, "propriété supplémentaire"],
    [{ ...approve, decision: "changes_requested" }, "décision hors périmètre"],
    [{ ...approve, decision: "published" }, "décision inconnue"],
    [{ ...approve, displayPrecision: "city" }, "précision inconnue"],
    [{ ...approve, sensitive: "non" }, "sensible non booléen"],
    [{ ...approve, internalNote: "x".repeat(2001) }, "note trop longue"],
    [{ ...approve, internalNote: 42 }, "note non textuelle"],
    [{ decision: "approved", internalNote: "" }, "publication sans précision ni sensibilité"],
    [{ ...approve, version: "hier" }, "version invalide"],
    [{}, "corps vide"],
    ["{pas du json", "JSON invalide"],
  ] as Array<[unknown, string]>)("400 neutre : %s (%s)", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "invalid_request", message: "Requête invalide." });
    expect(decideProposal).not.toHaveBeenCalled();
  });

  it("refus et doublon : précision et sensibilité ignorées, note nettoyée", async () => {
    decideProposal.mockResolvedValue({ ok: true, decision: "rejected", spot: null, emailSent: false });
    const response = await post({ decision: "rejected", internalNote: "  Motif  ", displayPrecision: "approximate", sensitive: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, decision: "rejected", state: "rejected", spot: null, emailSent: false });
    expect(decideProposal.mock.calls[0][1]).toMatchObject({ decision: "rejected", internalNote: "Motif", displayPrecision: "exact", sensitive: false });
    await post({ decision: "duplicate" });
    expect(decideProposal.mock.calls[1][1]).toMatchObject({ decision: "duplicate", internalNote: "" });
  });

  it("identifiant invalide : 404", async () => {
    expect((await post(approve, { id: "123" })).status).toBe(404);
  });
});

describe("échecs", () => {
  it.each([
    ["already_reviewed", 409, "Cette proposition a déjà été traitée."],
    ["decision_in_progress", 409, "Une décision est déjà en cours pour cette proposition."],
    ["proposal_changed", 409, null],
    ["not_found", 404, null],
    ["invalid_photo_count", 422, null],
    ["photo_download_failed", 502, null],
    ["photo_publish_failed", 502, null],
    ["decision_failed", 503, null],
    ["forbidden", 403, null],
  ])("%s → %i", async (reason, status, message) => {
    decideProposal.mockResolvedValue({ ok: false, reason });
    const response = await post(approve);
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe(reason);
    if (message) expect(body.message).toBe(message);
    expect(JSON.stringify(body)).not.toMatch(/supabase|postgres|proposals\/|spot-originals/i);
  });
});
