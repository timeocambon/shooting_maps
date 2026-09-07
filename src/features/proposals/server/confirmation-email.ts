import "server-only";

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

export async function sendProposalDecisionEmail(input: {
  email: string;
  trackingId: string;
  decision: ProposalDecision;
}): Promise<boolean> {
  const env = getServerEnv();
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) return false;

  const messages: Record<ProposalDecision, { subject: string; body: string }> = {
    approved: {
      subject: `Votre proposition ${input.trackingId} est publiée`,
      body: "Votre contribution a été vérifiée et publiée sur Spotride.",
    },
    changes_requested: {
      subject: `Des précisions sont nécessaires pour ${input.trackingId}`,
      body: "L'équipe de modération va vous contacter afin de compléter certaines informations avant de reprendre l'examen.",
    },
    rejected: {
      subject: `Décision concernant ${input.trackingId}`,
      body: "Votre contribution ne peut pas être publiée dans son état actuel. Merci d'avoir pris le temps de la proposer.",
    },
    duplicate: {
      subject: `Votre proposition ${input.trackingId} correspond à un spot existant`,
      body: "La proposition a été classée comme doublon lors de la modération.",
    },
  };
  const message = messages[input.decision];

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
        htmlContent: `<h1>${message.subject}</h1><p>${message.body}</p><p>Numéro de suivi : <strong>${input.trackingId}</strong></p>`,
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
