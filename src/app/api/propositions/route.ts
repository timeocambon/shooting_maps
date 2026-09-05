import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { proposalSubmissionSchema } from "@/features/proposals/domain/proposal";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export const runtime = "nodejs";

function hashCapability(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Étape 1/3 du dépôt d'une proposition : crée la proposition (texte uniquement,
// sans photos) et renvoie les identifiants/capacités nécessaires pour envoyer
// les photos directement vers Supabase Storage (voir /photos et /finalize),
// afin de ne jamais faire transiter les fichiers par cette fonction Vercel
// (limite stricte de 4,5 Mo par requête).
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return errorResponse("Le service de contribution n'est pas encore configuré.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Les informations du formulaire sont invalides.");
  }

  const parsed = proposalSubmissionSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Certains champs sont incomplets ou invalides.");
  }

  const emailToken = randomBytes(32).toString("base64url");
  const uploadSecret = randomBytes(32).toString("base64url");
  const supabase = createSupabasePublicServerClient();
  const { data: proposalRows, error: proposalError } = await supabase.rpc(
    "create_public_proposal",
    {
      p_payload: parsed.data.payload,
      p_email: parsed.data.email,
      p_pseudonym: parsed.data.pseudonym,
      p_email_token_hash: hashCapability(emailToken),
      p_upload_secret_hash: hashCapability(uploadSecret),
      p_rights_declared: parsed.data.rightsDeclared,
      p_people_confirmed: parsed.data.peopleConfirmed,
      p_charter_accepted: parsed.data.charterAccepted,
      p_terms_accepted: parsed.data.termsAccepted,
      p_privacy_accepted: parsed.data.privacyAccepted,
    },
  );

  const proposal = proposalRows?.[0];
  if (proposalError || !proposal) {
    const limited = proposalError?.message.includes("rate_limit");
    return errorResponse(
      limited
        ? "Trop de propositions ont été envoyées récemment avec cette adresse. Réessayez dans une heure."
        : "La proposition n'a pas pu être créée.",
      limited ? 429 : 500,
    );
  }

  return NextResponse.json({
    ok: true,
    proposalId: proposal.proposal_id,
    trackingId: proposal.tracking_id,
    uploadSecret,
    emailToken,
  });
}
