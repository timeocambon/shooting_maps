import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "@/lib/observability/sentry-scrub";

describe("scrubSentryEvent", () => {
  it("retire les cookies et en-têtes sensibles de la requête", () => {
    const event = {
      request: {
        cookies: { session: "abc" },
        headers: { authorization: "Bearer secret", cookie: "session=abc", "user-agent": "test" },
        data: { comment: "Contact-moi au marc.dupont@example.com" },
      },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.cookies).toBeUndefined();
    expect(scrubbed.request?.headers?.authorization).toBeUndefined();
    expect(scrubbed.request?.headers?.cookie).toBeUndefined();
    expect(scrubbed.request?.headers?.["user-agent"]).toBe("test");
  });

  it("masque un champ de formulaire connu comme sensible", () => {
    const event = {
      extra: { requesterEmail: "visiteur@example.com", kind: "photo" },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.extra?.requesterEmail).toBe("[retiré]");
    expect(scrubbed.extra?.kind).toBe("photo");
  });

  it("masque une adresse e-mail et un numéro de téléphone trouvés dans un texte libre", () => {
    const event = {
      message: "Erreur pour marc.dupont@example.com, tél 06 12 34 56 78",
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.message).not.toContain("marc.dupont@example.com");
    expect(scrubbed.message).not.toContain("06 12 34 56 78");
    expect(scrubbed.message).toContain("[e-mail masqué]");
    expect(scrubbed.message).toContain("[téléphone masqué]");
  });

  it("retire l'e-mail et l'adresse IP de l'utilisateur sans toucher au reste", () => {
    const event = {
      user: { id: "user-1", email: "visiteur@example.com", ip_address: "203.0.113.4" },
    };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.user?.id).toBe("user-1");
    expect(scrubbed.user?.email).toBeUndefined();
    expect(scrubbed.user?.ip_address).toBeUndefined();
  });

  it("laisse un événement sans donnée sensible inchangé", () => {
    const event = { message: "Erreur réseau générique", extra: { retries: 2 } };

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.message).toBe("Erreur réseau générique");
    expect(scrubbed.extra?.retries).toBe(2);
  });
});
