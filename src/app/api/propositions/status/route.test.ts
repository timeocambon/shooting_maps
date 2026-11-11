// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let configured = true;

vi.mock("@/lib/supabase/service-role-server", () => ({
  isServiceRoleConfigured: () => configured,
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));

const { POST } = await import("@/app/api/propositions/status/route");

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/propositions/status", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const item = (n: number, email = "rider@example.com") => ({
  trackingId: `SPT-STATUS${String(n).padStart(4, "0")}`,
  email,
});

beforeEach(() => {
  configured = true;
  rpc.mockReset();
});

describe("POST /api/propositions/status", () => {
  it("renvoie le statut public quand numéro et e-mail correspondent", async () => {
    rpc.mockResolvedValue({
      data: [
        { tracking_id: "SPT-STATUS0001", status: "in_review", updated_at: "2026-11-10T09:30:00+00:00" },
        { tracking_id: "SPT-STATUS0002", status: "published", updated_at: "2026-11-11T08:00:00+00:00" },
      ],
      error: null,
    });

    const response = await post({ items: [item(1, "  Rider@Example.COM "), item(2)] });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toEqual({
      ok: true,
      results: [
        { trackingId: "SPT-STATUS0001", status: "in_review", updatedAt: "2026-11-10T09:30:00.000Z" },
        { trackingId: "SPT-STATUS0002", status: "published", updatedAt: "2026-11-11T08:00:00.000Z" },
      ],
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("lookup_proposal_statuses");
    // E-mail normalisé transmis à la fonction, empreinte client (jamais l'IP en clair).
    expect(args.p_items).toEqual([item(1), item(2)]);
    expect(args.p_client_key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("répond de façon neutre pour un mauvais e-mail comme pour un numéro inconnu", async () => {
    rpc.mockResolvedValue({
      data: [
        { tracking_id: "SPT-STATUS0001", status: "unknown", updated_at: null },
        { tracking_id: "SPT-INCONNU999", status: "unknown", updated_at: null },
      ],
      error: null,
    });

    const payload = await (await post({ items: [item(1, "intrus@example.com"), { trackingId: "SPT-INCONNU999", email: "rider@example.com" }] })).json();

    expect(payload.results).toEqual([
      { trackingId: "SPT-STATUS0001", status: "unknown", updatedAt: null },
      { trackingId: "SPT-INCONNU999", status: "unknown", updatedAt: null },
    ]);
    expect(payload.results[0]).toEqual({ ...payload.results[1], trackingId: "SPT-STATUS0001" });
  });

  it("ne renvoie jamais e-mail, identifiant interne ni commentaire, même si la base en fournissait", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          tracking_id: "SPT-STATUS0001",
          status: "rejected",
          updated_at: "2026-11-10T09:30:00Z",
          id: "a1111111-1111-4111-8111-111111111111",
          contributor_email: "rider@example.com",
          moderation_comment: "Commentaire interne",
        },
      ],
      error: null,
    });

    const text = await (await post({ items: [item(1)] })).text();

    expect(text).not.toContain("rider@example.com");
    expect(text).not.toContain("a1111111");
    expect(text).not.toContain("Commentaire");
    expect(JSON.parse(text).results[0]).toEqual({
      trackingId: "SPT-STATUS0001",
      status: "rejected",
      updatedAt: "2026-11-10T09:30:00.000Z",
    });
  });

  it("transforme un état interne inattendu ou une ligne absente en « unknown »", async () => {
    rpc.mockResolvedValue({
      data: [{ tracking_id: "SPT-STATUS0001", status: "approved", updated_at: "2026-11-10T09:30:00Z" }],
      error: null,
    });

    const payload = await (await post({ items: [item(1), item(2)] })).json();

    expect(payload.results).toEqual([
      { trackingId: "SPT-STATUS0001", status: "unknown", updatedAt: null },
      { trackingId: "SPT-STATUS0002", status: "unknown", updatedAt: null },
    ]);
  });

  it("dédoublonne les numéros et conserve l'ordre de la requête", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await post({ items: [item(2), item(1), item(2, "autre@example.com")] });

    expect(rpc.mock.calls[0][1].p_items).toEqual([item(2), item(1)]);
  });

  it.each([
    ["plus de 20 éléments", { items: Array.from({ length: 21 }, (_, i) => item(i + 1)) }],
    ["lot vide", { items: [] }],
    ["numéro mal formé", { items: [{ trackingId: "spt-status0001", email: "rider@example.com" }] }],
    ["e-mail absent", { items: [{ trackingId: "SPT-STATUS0001" }] }],
    ["e-mail vide", { items: [{ trackingId: "SPT-STATUS0001", email: "   " }] }],
    ["e-mail trop long", { items: [item(1, `${"x".repeat(320)}@example.com`)] }],
    ["clé supplémentaire", { items: [{ ...item(1), proposalId: "x" }] }],
    ["champ racine supplémentaire", { items: [item(1)], debug: true }],
    ["corps illisible", "{pas du json"],
  ])("refuse une requête invalide (%s) sans interroger la base", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Requête invalide." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepte exactement 20 éléments", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const response = await post({ items: Array.from({ length: 20 }, (_, i) => item(i + 1)) });
    expect(response.status).toBe(200);
    expect((await response.json()).results).toHaveLength(20);
  });

  it("traduit la limitation de la base en 429", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "rate_limit", code: "P0001" } });
    const response = await post({ items: [item(1)] });
    expect(response.status).toBe(429);
    expect((await response.json()).ok).toBe(false);
  });

  it("renvoie 503 sans détail technique si la base échoue ou répond mal", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function lookup_proposal_statuses" } });
    const failed = await post({ items: [item(1)] });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("permission");

    rpc.mockResolvedValueOnce({ data: { inattendu: true }, error: null });
    expect((await post({ items: [item(1)] })).status).toBe(503);

    rpc.mockRejectedValueOnce(new Error("fetch failed"));
    expect((await post({ items: [item(1)] })).status).toBe(503);
  });

  it("renvoie 503 si la clé de service n'est pas configurée", async () => {
    configured = false;
    expect((await post({ items: [item(1)] })).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dérive une empreinte client stable de l'adresse transmise par la plateforme", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await post({ items: [item(1)] }, { "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    await post({ items: [item(1)] }, { "x-forwarded-for": "203.0.113.7" });
    await post({ items: [item(1)] }, { "x-forwarded-for": "198.51.100.2" });
    const keys = rpc.mock.calls.map((call) => call[1].p_client_key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys.join()).not.toContain("203.0.113.7");
  });
});
