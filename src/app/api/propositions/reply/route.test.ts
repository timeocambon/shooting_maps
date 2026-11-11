// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let configured = true;

vi.mock("@/lib/supabase/service-role-server", () => ({
  isServiceRoleConfigured: () => configured,
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));

const { POST } = await import("@/app/api/propositions/reply/route");

const valid = {
  trackingId: "SPT-ECHANGE001",
  email: "  Rider@Example.COM ",
  message: "  Le parking est derrière l'église.  ",
  idempotencyKey: "reponse-mh2k8x-a1b2c3d4",
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/propositions/reply", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  configured = true;
  rpc.mockReset();
});

describe("POST /api/propositions/reply", () => {
  it("transmet la réponse normalisée et renvoie le nouveau statut", async () => {
    rpc.mockResolvedValue({ data: "received", error: null });

    const response = await post(valid, { "x-forwarded-for": "203.0.113.9" });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, status: "in_review" });
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("reply_to_proposal_request");
    expect(args).toEqual({
      p_tracking_id: "SPT-ECHANGE001",
      p_email: "rider@example.com",
      p_response: "Le parking est derrière l'église.",
      p_idempotency_key: "reponse-mh2k8x-a1b2c3d4",
      p_client_key: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(JSON.stringify(args)).not.toContain("203.0.113.9");
  });

  it("double appui : même succès quand la réponse est déjà enregistrée", async () => {
    rpc.mockResolvedValueOnce({ data: "received", error: null });
    rpc.mockResolvedValueOnce({ data: "already_received", error: null });

    const first = await (await post(valid)).json();
    const second = await (await post(valid)).json();

    expect(second).toEqual(first);
    expect(rpc.mock.calls[0][1].p_idempotency_key).toBe(rpc.mock.calls[1][1].p_idempotency_key);
  });

  it("répond de façon identique pour un numéro inconnu, un mauvais e-mail ou sans demande ouverte", async () => {
    rpc.mockResolvedValue({ data: "not_found", error: null });

    const bodies = await Promise.all([
      post({ ...valid, email: "intrus@example.com" }),
      post({ ...valid, trackingId: "SPT-INCONNU001" }),
      post(valid),
    ]);

    const payloads = await Promise.all(bodies.map(async (response) => [response.status, await response.text()]));
    expect(new Set(payloads.map((entry) => JSON.stringify(entry))).size).toBe(1);
    expect(payloads[0][0]).toBe(404);
    expect(JSON.parse(payloads[0][1] as string)).toEqual({
      ok: false,
      error: "not_found",
      message: "Aucune demande de précisions n'attend de réponse pour cette proposition.",
    });
  });

  it.each([
    ["réponse vide", { ...valid, message: "   " }],
    ["réponse de plus de 2000 caractères", { ...valid, message: "r".repeat(2001) }],
  ])("refuse une %s sans appeler la base", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_message");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepte exactement 2000 caractères après suppression des espaces", async () => {
    rpc.mockResolvedValue({ data: "received", error: null });
    const response = await post({ ...valid, message: `  ${"r".repeat(2000)}  ` });
    expect(response.status).toBe(200);
    expect(rpc.mock.calls[0][1].p_response).toHaveLength(2000);
  });

  it.each([
    ["numéro mal formé", { ...valid, trackingId: "SPT-123" }],
    ["e-mail absent", { trackingId: valid.trackingId, message: valid.message, idempotencyKey: valid.idempotencyKey }],
    ["clé d'idempotence trop courte", { ...valid, idempotencyKey: "court" }],
    ["clé d'idempotence invalide", { ...valid, idempotencyKey: "clé avec espaces !!" }],
    ["champ supplémentaire", { ...valid, proposalId: "c1111111-1111-4111-8111-111111111111" }],
    ["corps illisible", "{pas du json"],
  ])("refuse une requête invalide (%s)", async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_request");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduit la limitation de fréquence en 429", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "rate_limit" } });
    const response = await post(valid);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("rate_limit");
  });

  it("renvoie 503 sans détail technique en cas d'erreur de la base ou de réponse inattendue", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied for function reply_to_proposal_request" } });
    const failed = await post(valid);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("permission");

    rpc.mockResolvedValueOnce({ data: "autre", error: null });
    expect((await post(valid)).status).toBe(503);

    rpc.mockRejectedValueOnce(new Error("fetch failed"));
    expect((await post(valid)).status).toBe(503);

    configured = false;
    expect((await post(valid)).status).toBe(503);
  });
});
