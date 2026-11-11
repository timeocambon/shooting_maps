// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { escapeHtmlText, hasUnreviewedResponse, toExchanges } = await import(
  "@/features/proposals/domain/change-request"
);
const { buildProposalDecisionEmail } = await import("@/features/proposals/server/confirmation-email");

const rows = [
  { id: "2", public_message: "Seconde demande", requested_at: "2026-11-11T10:00:00Z", response: "Réponse 2", responded_at: "2026-11-11T11:00:00Z", closed_at: "2026-11-11T11:00:00Z" },
  { id: "1", public_message: "Première demande", requested_at: "2026-11-10T10:00:00Z", response: "Réponse 1", responded_at: "2026-11-10T11:00:00Z", closed_at: "2026-11-10T11:00:00Z" },
];

describe("historique des demandes de précisions", () => {
  it("trie les échanges du plus ancien au plus récent", () => {
    expect(toExchanges(rows).map((exchange) => exchange.id)).toEqual(["1", "2"]);
    expect(toExchanges(null)).toEqual([]);
  });

  it("signale une réponse arrivée tant qu'aucune nouvelle décision n'est prise", () => {
    const exchanges = toExchanges(rows);
    expect(hasUnreviewedResponse("submitted", exchanges)).toBe(true);
    expect(hasUnreviewedResponse("changes_requested", exchanges)).toBe(false);
    expect(hasUnreviewedResponse("approved", exchanges)).toBe(false);
    expect(hasUnreviewedResponse("submitted", [])).toBe(false);
    const awaiting = toExchanges([...rows, { id: "3", public_message: "Troisième", requested_at: "2026-11-12T10:00:00Z", response: null, responded_at: null, closed_at: "2026-11-12T12:00:00Z" }]);
    expect(hasUnreviewedResponse("submitted", awaiting)).toBe(false);
  });
});

describe("e-mail de demande de précisions", () => {
  const siteUrl = "https://www.spot-ride.fr";

  it("inclut le message public échappé et invite à ouvrir l'application ou le suivi", () => {
    const email = buildProposalDecisionEmail({
      trackingId: "SPT-ECHANGE001",
      decision: "changes_requested",
      publicMessage: "Pouvez-vous préciser <l'accès> ?\nMerci & à bientôt",
      siteUrl,
    });
    expect(email.subject).toBe("Des précisions sont nécessaires pour SPT-ECHANGE001");
    expect(email.html).toContain("Pouvez-vous préciser &lt;l&#39;accès&gt; ?<br />Merci &amp; à bientôt");
    expect(email.html).not.toContain("<l'accès>");
    expect(email.html).toContain("application Spotride");
    expect(email.html).toContain("https://www.spot-ride.fr/proposition-confirmee?suivi=SPT-ECHANGE001");
  });

  it("n'accepte aucune note interne : seul le message public peut figurer dans l'e-mail", () => {
    const email = buildProposalDecisionEmail({
      trackingId: "SPT-ECHANGE001",
      decision: "changes_requested",
      publicMessage: "Message public",
      siteUrl,
      // @ts-expect-error la note interne n'est pas un paramètre de l'e-mail
      internalNote: "NOTE-INTERNE",
    });
    expect(email.html).not.toContain("NOTE-INTERNE");
  });

  it("garde les e-mails des autres décisions sans message libre", () => {
    const email = buildProposalDecisionEmail({ trackingId: "SPT-ECHANGE001", decision: "rejected", publicMessage: "ignoré", siteUrl });
    expect(email.html).not.toContain("ignoré");
    expect(email.subject).toBe("Décision concernant SPT-ECHANGE001");
  });

  it("échappe tout texte libre", () => {
    expect(escapeHtmlText(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });
});
