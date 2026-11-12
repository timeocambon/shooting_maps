// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/admin/mobile/reports/{id}/decision : contrôles d'accès des
 * endpoints mobiles, corps strict, puis `decideReport` (module partagé avec
 * le site) qui appelle `admin_review_report` une seule fois avec le client
 * lié au jeton. La fonction SQL (verrou, transitions, masquage, audit) est
 * simulée ici et testée à part en SQL.
 */

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
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
  sendProposalDecisionEmail: sendEmail,
  sendProposalConfirmationEmail: sendEmail,
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://projet.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

const REPORT_ID = "e1111111-1111-4111-8111-111111111111";
const SPOT_ID = "a1111111-1111-4111-8111-111111111111";
const NOW_S = Math.floor(Date.now() / 1000);

type World = {
  claims: Record<string, unknown> | null;
  access: { data: unknown; error: unknown };
  state: "open" | "in_review" | "resolved" | "dismissed" | null;
  spotState: string;
  reviewThrows: boolean;
  reviewError: string | null;
  calls: Array<[string, Record<string, unknown>]>;
};
let w: World;

/** Simulation fidèle de admin_review_report (mêmes contrôles, même ordre). */
function reviewReport(args: Record<string, unknown>) {
  if (w.reviewThrows) throw new Error("fetch failed");
  if (w.reviewError) return { data: null, error: { message: w.reviewError, code: "P0001", details: "SQL interne" } };
  if (w.state === null) return { data: null, error: { message: "report_not_found", code: "P0001" } };
  if (w.state === "resolved" || w.state === "dismissed") return { data: null, error: { message: "report_already_reviewed", code: "P0001" } };
  const next = args.p_next_state as string;
  if (!["in_review", "resolved", "dismissed"].includes(next)) return { data: null, error: { message: "invalid_decision" } };
  if (String(args.p_internal_note ?? "").trim().length > 2000) return { data: null, error: { message: "invalid_note" } };
  if (next !== "in_review" && !(String(args.p_decision ?? "").trim().length >= 3)) return { data: null, error: { message: "decision_required" } };
  if (args.p_hide_spot && ["published", "sensitive", "review_due"].includes(w.spotState)) w.spotState = "hidden";
  w.state = next as World["state"];
  return { data: SPOT_ID, error: null };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => (w.claims ? { data: { claims: w.claims }, error: null } : { data: null, error: { message: "invalid JWT" } }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      w.calls.push([name, args]);
      if (name === "admin_mobile_access") return w.access;
      if (name === "admin_review_report") return reviewReport(args);
      throw new Error(`appel inattendu : ${name}`);
    },
    from: (table: string) => {
      if (table !== "spots") throw new Error(`lecture inattendue : ${table}`);
      const builder = {
        select: () => builder,
        eq: (_: string, id: string) => {
          expect(id).toBe(SPOT_ID);
          return builder;
        },
        maybeSingle: async () => ({ data: { publication_state: w.spotState }, error: null }),
      };
      return builder;
    },
  }),
}));

const { POST } = await import("@/app/api/admin/mobile/reports/[id]/decision/route");
const { mapReportReviewError, validateReportDecision } = await import("@/features/reports/server/report-decision");

const jwt = (payload: Record<string, unknown>) => {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${enc({ alg: "ES256" })}.${enc(payload)}.sig`;
};
const staff = (aal = "aal2") => ({ sub: "b2222222-2222-4222-8222-222222222222", role: "authenticated", aal, exp: NOW_S + 3600 });
const post = (body: unknown, { token = jwt(staff()), id = REPORT_ID }: { token?: string | null; id?: string } = {}) =>
  POST(
    new Request(`http://localhost/api/admin/mobile/reports/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
const resolve = { nextState: "resolved", decision: "Portail vérifié : accès fermé.", internalNote: "NOTE-INTERNE-SECRETE", hideSpot: true };
const reviewCalls = () => w.calls.filter(([name]) => name === "admin_review_report");

beforeEach(() => {
  w = { claims: staff(), access: { data: "moderator", error: null }, state: "open", spotState: "published", reviewThrows: false, reviewError: null, calls: [] };
  revalidatePath.mockReset();
  sendEmail.mockReset();
});

describe("accès", () => {
  it("sans jeton : 401 unauthenticated, aucun appel", async () => {
    const response = await post(resolve, { token: null });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthenticated" });
    expect(w.calls).toHaveLength(0);
  });

  it("jeton invalide : 401 ; jeton expiré : 401 session_expired", async () => {
    w.claims = null;
    expect((await post(resolve)).status).toBe(401);
    const expired = await post(resolve, { token: jwt({ ...staff(), exp: NOW_S - 1 }) });
    expect(expired.status).toBe(401);
    expect(await expired.json()).toMatchObject({ error: "session_expired" });
    expect(reviewCalls()).toHaveLength(0);
  });

  it("utilisateur normal : 403 forbidden ; équipe en AAL1 : 403 mfa_required", async () => {
    w.access = { data: "forbidden", error: null };
    expect(await (await post(resolve)).json()).toMatchObject({ error: "forbidden" });
    w.access = { data: "mfa_required", error: null };
    w.claims = staff("aal1");
    const response = await post(resolve);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "mfa_required" });
    expect(reviewCalls()).toHaveLength(0);
    expect(w.state).toBe("open");
  });

  it("limitation de débit (écritures) : 429", async () => {
    w.access = { data: "rate_limit", error: null };
    expect((await post(resolve)).status).toBe(429);
    expect(w.calls).toEqual([["admin_mobile_access", { p_action: "write" }]]);
  });
});

describe("corps strict et validation", () => {
  it.each([
    [{ ...resolve, spotId: "b9999999-9999-4999-8999-999999999999" }, "invalid_request", 400],
    [{ ...resolve, previousState: "open" }, "invalid_request", 400],
    [{ ...resolve, role: "administrator" }, "invalid_request", 400],
    [{ ...resolve, nextState: "open" }, "invalid_request", 400],
    [{ ...resolve, nextState: "deleted" }, "invalid_request", 400],
    [{ ...resolve, hideSpot: "true" }, "invalid_request", 400],
    [{ nextState: "resolved", decision: "Décision", internalNote: "" }, "invalid_request", 400],
    [{ ...resolve, decision: "x".repeat(1001) }, "invalid_request", 400],
    ["{pas du json", "invalid_request", 400],
    [{ ...resolve, decision: " ok " }, "decision_required", 422],
    [{ ...resolve, nextState: "dismissed", decision: "" }, "decision_required", 422],
    [{ ...resolve, internalNote: "y".repeat(2001) }, "invalid_note", 422],
  ] as Array<[unknown, string, number]>)("%j → %s", async (body, error, status) => {
    const response = await post(body);
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(error);
    expect(reviewCalls()).toHaveLength(0);
    expect(w.state).toBe("open");
  });

  it("identifiant invalide : 404", async () => {
    expect((await post(resolve, { id: "pas-un-uuid" })).status).toBe(404);
  });
});

describe("décisions", () => {
  it("prise en charge : décision vide acceptée, admin_review_report appelé une seule fois", async () => {
    const response = await post({ nextState: "in_review", decision: "", internalNote: "", hideSpot: false });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, reportId: REPORT_ID, state: "in_review", spot: { id: SPOT_ID, hidden: false } });
    expect(reviewCalls()).toEqual([["admin_review_report", { p_report_id: REPORT_ID, p_next_state: "in_review", p_decision: "", p_internal_note: "", p_hide_spot: false }]]);
  });

  it("résolution avec masquage : spot du signalement masqué, réponse minimale sans note", async () => {
    const response = await post({ ...resolve, decision: "  Portail vérifié : accès fermé.  ", internalNote: "  NOTE-INTERNE-SECRETE  " });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, reportId: REPORT_ID, state: "resolved", spot: { id: SPOT_ID, hidden: true } });
    expect(reviewCalls()).toHaveLength(1);
    expect(reviewCalls()[0][1]).toMatchObject({ p_decision: "Portail vérifié : accès fermé.", p_internal_note: "NOTE-INTERNE-SECRETE", p_hide_spot: true });
    expect(JSON.stringify(body)).not.toMatch(/NOTE-INTERNE|@|spot-originals|storage|SQL/);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/signalements");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("classement sans suite sans masquage : spot inchangé", async () => {
    const response = await post({ nextState: "dismissed", decision: "Information exacte.", internalNote: "", hideSpot: false });
    expect(await response.json()).toEqual({ ok: true, reportId: REPORT_ID, state: "dismissed", spot: { id: SPOT_ID, hidden: false } });
    expect(w.spotState).toBe("published");
  });

  it("masquage demandé sur une fiche déjà masquée : hidden=true, état réel relu", async () => {
    w.spotState = "hidden";
    expect((await (await post(resolve)).json()).spot).toEqual({ id: SPOT_ID, hidden: true });
  });

  it("double décision finale : la seconde reçoit 409 « déjà traité », une seule transition", async () => {
    expect((await post(resolve)).status).toBe(200);
    const second = await post({ ...resolve, nextState: "dismissed", decision: "Autre avis", hideSpot: false });
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ ok: false, error: "already_reviewed", message: "Ce signalement a déjà été traité." });
    expect(w.state).toBe("resolved");
  });

  it("signalement introuvable : 404", async () => {
    w.state = null;
    const response = await post(resolve);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, error: "not_found", message: "Signalement introuvable." });
  });

  it("erreur Supabase : 503 neutre, sans texte SQL", async () => {
    w.reviewError = 'Invalid report state transition: open -> resolved (relation "reports")';
    let response = await post(resolve);
    expect(response.status).toBe(503);
    let text = JSON.stringify(await response.json());
    expect(text).toContain("decision_failed");
    expect(text).not.toMatch(/transition|relation|reports|SQL|P0001/);
    w.reviewError = null;
    w.reviewThrows = true;
    response = await post(resolve);
    expect(response.status).toBe(503);
    text = JSON.stringify(await response.json());
    expect(text).not.toMatch(/fetch failed/);
  });

  it("droits refusés par la fonction : 403", async () => {
    w.reviewError = "Forbidden";
    expect((await post(resolve)).status).toBe(403);
  });
});

describe("module partagé", () => {
  it("validation identique au site (textes nettoyés, longueurs, décision finale)", () => {
    expect(validateReportDecision({ reportId: REPORT_ID, nextState: "in_review", decision: "  ", internalNote: "", hideSpot: false })).toEqual({
      ok: true,
      value: { reportId: REPORT_ID, nextState: "in_review", decision: "", internalNote: "", hideSpot: false },
    });
    expect(validateReportDecision({ reportId: REPORT_ID, nextState: "resolved", decision: "ab", internalNote: "", hideSpot: false })).toEqual({ ok: false, error: "decision_required" });
    expect(validateReportDecision({ reportId: "x", nextState: "resolved", decision: "abc", internalNote: "", hideSpot: false })).toEqual({ ok: false, error: "invalid_request" });
    expect(validateReportDecision({ reportId: REPORT_ID, nextState: "resolved", decision: "abc", internalNote: "", hideSpot: "on" })).toEqual({ ok: false, error: "invalid_request" });
  });

  it("conversion des erreurs Supabase en erreurs publiques stables", () => {
    expect(mapReportReviewError("report_already_reviewed")).toBe("already_reviewed");
    expect(mapReportReviewError("report_not_found")).toBe("not_found");
    expect(mapReportReviewError("decision_required")).toBe("decision_required");
    expect(mapReportReviewError("invalid_note")).toBe("invalid_note");
    expect(mapReportReviewError("invalid_decision")).toBe("invalid_request");
    expect(mapReportReviewError("Forbidden")).toBe("forbidden");
    expect(mapReportReviewError("deadlock detected")).toBe("decision_failed");
    expect(mapReportReviewError(undefined)).toBe("decision_failed");
  });
});
