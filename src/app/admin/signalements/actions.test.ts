// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

/** L'action du site garde ses redirections ; le traitement passe par le module partagé. */

vi.mock("server-only", () => ({}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
let session: { status: string } = { status: "authenticated" };
vi.mock("@/features/admin/admin-session", () => ({ getAdminSessionState: async () => session }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc,
    from: () => {
      const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: { publication_state: "hidden" }, error: null }) };
      return builder;
    },
  }),
}));

const { reviewReportAction } = await import("@/app/admin/signalements/actions");
const ID = "e1111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
};
const run = async (values: Record<string, string>) => {
  try {
    await reviewReportAction(ID, form(values));
  } catch (error) {
    return (error as Error).message.replace("REDIRECT:", "");
  }
  return null;
};

beforeEach(() => {
  session = { status: "authenticated" };
  rpc.mockReset();
  rpc.mockResolvedValue({ data: "a1111111-1111-4111-8111-111111111111", error: null });
  revalidatePath.mockReset();
});

describe("reviewReportAction (site)", () => {
  it("session non autorisée : retour à /admin, aucun appel", async () => {
    session = { status: "mfa_required" };
    expect(await run({ nextState: "resolved", decision: "Vérifié" })).toBe("/admin");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validation : mêmes règles qu'avant (décision finale ≥ 3, note ≤ 2000, état connu)", async () => {
    expect(await run({ nextState: "resolved", decision: "ok" })).toBe(`/admin/signalements/${ID}?erreur=validation`);
    expect(await run({ nextState: "dismissed", decision: "Motif", internalNote: "x".repeat(2001) })).toBe(`/admin/signalements/${ID}?erreur=validation`);
    expect(await run({ nextState: "open", decision: "Motif" })).toBe(`/admin/signalements/${ID}?erreur=validation`);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("succès : un appel à admin_review_report, cases cochées converties, mêmes pages actualisées", async () => {
    expect(await run({ nextState: "resolved", decision: "  Vérifié sur place ", internalNote: " RAS ", hideSpot: "on" })).toBe("/admin/signalements?decision=resolved");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("admin_review_report", {
      p_report_id: ID,
      p_next_state: "resolved",
      p_decision: "Vérifié sur place",
      p_internal_note: "RAS",
      p_hide_spot: true,
    });
    expect(revalidatePath.mock.calls.map(([path]) => path)).toEqual(["/", "/admin", "/admin/signalements", "/admin/spots"]);
    expect(await run({ nextState: "in_review" })).toBe("/admin/signalements?decision=in_review");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_decision: "", p_hide_spot: false });
  });

  it("erreurs : déjà traité → deja-traite ; autre → traitement", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "report_already_reviewed" } });
    expect(await run({ nextState: "resolved", decision: "Vérifié" })).toBe(`/admin/signalements/${ID}?erreur=deja-traite`);
    rpc.mockResolvedValue({ data: null, error: { message: "decision_required" } });
    expect(await run({ nextState: "resolved", decision: "Vérifié" })).toBe(`/admin/signalements/${ID}?erreur=traitement`);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
