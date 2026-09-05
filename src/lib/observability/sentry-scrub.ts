// Retire les e-mails, numéros de téléphone et champs de formulaire sensibles
// avant l'envoi d'un événement à Sentry. Voir docs/decisions-techniques.md :
// « Sentry sera utilisé pour les erreurs avec filtrage des e-mails,
// coordonnées, jetons et contenus de formulaire. »
//
// Générique et structurel plutôt que lié aux types exacts du SDK Sentry :
// utilisable aussi bien pour beforeSend (erreurs) que beforeSendTransaction
// (transactions), dont les formes diffèrent légèrement.

const SENSITIVE_KEYS = new Set([
  "email",
  "reporter_email",
  "reporterEmail",
  "requester_email",
  "requesterEmail",
  "contributor_email",
  "contributorEmail",
  "comment",
  "description",
  "decision",
  "internal_note",
  "internalNote",
  "address",
  "shortDescription",
  "short_description",
  "cookie",
  "cookies",
  "authorization",
  "api-key",
  "apiKey",
  "password",
  "token",
]);

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_PATTERN = /(?:\+33|0)[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g;

function redactString(value: string): string {
  return value.replace(EMAIL_PATTERN, "[e-mail masqué]").replace(PHONE_PATTERN, "[téléphone masqué]");
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key) ? "[retiré]" : scrubValue(entry, seen);
  }
  return result;
}

type ScrubbableEvent = {
  request?: {
    cookies?: unknown;
    headers?: Record<string, string | undefined>;
    data?: unknown;
  };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: Array<{ message?: string; data?: unknown; [key: string]: unknown }>;
  message?: string;
  exception?: { values?: Array<{ value?: string; [key: string]: unknown }> };
  user?: { email?: string; ip_address?: string; [key: string]: unknown };
  [key: string]: unknown;
};

export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const seen = new WeakSet<object>();

  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    if (event.request.data) {
      event.request.data = scrubValue(event.request.data, seen);
    }
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra, seen) as Record<string, unknown>;
  }
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts, seen) as Record<string, unknown>;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb.message ? redactString(breadcrumb.message) : breadcrumb.message,
      data: breadcrumb.data ? scrubValue(breadcrumb.data, seen) : breadcrumb.data,
    }));
  }
  if (event.message) {
    event.message = redactString(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = redactString(exception.value);
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
  }

  return event;
}
