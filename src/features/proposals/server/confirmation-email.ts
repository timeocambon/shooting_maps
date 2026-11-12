import "server-only";

import { escapeHtmlText } from "@/features/proposals/domain/change-request";
import { getServerEnv } from "@/lib/server-env";

type ConfirmationEmailInput = {
  email: string;
  trackingId: string;
  token: string;
};

export type ConfirmationEmailResult = {
  sent: boolean;
  developmentConfirmationUrl: string | null;
};

type ProposalDecision = "approved" | "changes_requested" | "rejected" | "duplicate";

export function buildConfirmationUrl(token: string): string {
  const { NEXT_PUBLIC_SITE_URL } = getServerEnv();
  const url = new URL("/proposition-confirmee/verifier", NEXT_PUBLIC_SITE_URL);
  url.searchParams.set("jeton", token);
  return url.toString();
}

export async function sendProposalConfirmationEmail({
  email,
  trackingId,
  token,
}: ConfirmationEmailInput): Promise<ConfirmationEmailResult> {
  const env = getServerEnv();
  const confirmationUrl = buildConfirmationUrl(token);

  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
    return {
      sent: process.env.NODE_ENV !== "production",
      developmentConfirmationUrl:
        process.env.NODE_ENV !== "production" ? confirmationUrl : null,
    };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to: [{ email }],
        subject: `Confirmez votre proposition ${trackingId}`,
        htmlContent: `
          <h1>Confirmez votre proposition</h1>
          <p>Merci d'avoir partagé un spot avec Spotride.</p>
          <p><a href="${confirmationUrl}">Confirmer mon adresse e-mail</a></p>
          <p>Votre numéro de suivi est <strong>${trackingId}</strong>. Ce lien expire dans 24 heures et ne peut être utilisé qu'une fois.</p>
          <p>Aucune proposition n'est publiée automatiquement.</p>
        `,
      }),
      cache: "no-store",
    });

    return { sent: response.ok, developmentConfirmationUrl: null };
  } catch {
    return { sent: false, developmentConfirmationUrl: null };
  }
}

/**
 * Contenu de l'e-mail de décision. Ne reçoit jamais la note interne : seul
 * le message public (demande de précisions) peut y figurer, échappé.
 */
export function buildProposalDecisionEmail(input: {
  trackingId: string;
  decision: ProposalDecision;
  publicMessage?: string | null;
  siteUrl: string;
  /** Page publique du spot publié (absente pour un lieu sensible). */
  spotUrl?: string | null;
}): { subject: string; html: string } {
  const trackingId = escapeHtmlText(input.trackingId);
  const messages: Record<ProposalDecision, { subject: string; body: string }> = {
    approved: {
      subject: `Votre proposition ${input.trackingId} est publiée`,
      body: "<p>Votre contribution a été vérifiée et publiée sur Spotride. Merci pour ce partage !</p>",
    },
    changes_requested: {
      subject: `Des précisions sont nécessaires pour ${input.trackingId}`,
      body: "",
    },
    rejected: {
      subject: `Décision concernant ${input.trackingId}`,
      body: "<p>Votre contribution ne peut pas être publiée dans son état actuel. Merci d'avoir pris le temps de la proposer.</p>",
    },
    duplicate: {
      subject: `Votre proposition ${input.trackingId} correspond à un spot existant`,
      body: "<p>Un spot similaire existe déjà sur Spotride : votre proposition a été classée comme doublon. Merci d'avoir pris le temps de la proposer.</p>",
    },
  };
  const message = messages[input.decision];

  if (input.decision === "approved" && input.spotUrl) {
    message.body += `<p><a href="${escapeHtmlText(input.spotUrl)}">Voir le spot sur Spotride</a></p>`;
  }

  if (input.decision === "changes_requested") {
    const trackingUrl = new URL("/proposition-confirmee", input.siteUrl);
    trackingUrl.searchParams.set("suivi", input.trackingId);
    const publicMessage = input.publicMessage?.trim()
      ? `<blockquote>${escapeHtmlText(input.publicMessage.trim())}</blockquote>`
      : "";
    message.body = `
      <p>L'équipe de modération a besoin de précisions avant de reprendre l'examen :</p>
      ${publicMessage}
      <p>Répondez depuis l'application Spotride : onglet <strong>Compte</strong>, section <strong>Mes propositions</strong>, bouton <strong>Répondre</strong>.</p>
      <p>Vous pouvez aussi consulter la <a href="${escapeHtmlText(trackingUrl.toString())}">page de suivi</a>.</p>
    `;
  }

  return {
    subject: message.subject,
    html: `<h1>${escapeHtmlText(message.subject)}</h1>${message.body}<p>Numéro de suivi : <strong>${trackingId}</strong></p>`,
  };
}

export async function sendProposalDecisionEmail(input: {
  email: string;
  trackingId: string;
  decision: ProposalDecision;
  /** Message public de la demande de précisions (jamais la note interne). */
  publicMessage?: string | null;
  /** Page publique du spot publié. */
  spotUrl?: string | null;
}): Promise<boolean> {
  const env = getServerEnv();
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) return false;

  const message = buildProposalDecisionEmail({
    trackingId: input.trackingId,
    decision: input.decision,
    publicMessage: input.publicMessage,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    spotUrl: input.spotUrl,
  });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME },
        to: [{ email: input.email }],
        subject: message.subject,
        htmlContent: message.html,
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
