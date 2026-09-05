import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

export const runtime = "nodejs";

const bodySchema = z.object({
  proposalId: z.string().min(1),
  uploadSecret: z.string().min(1),
  index: z.number().int().min(0).max(5),
});

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

// Étape 2/3 : prépare une URL d'envoi signée pour une photo. Le navigateur
// enverra ensuite le fichier directement à Supabase Storage avec ce jeton,
// sans passer par une fonction Vercel (donc sans sa limite de 4,5 Mo).
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return errorResponse("Le service de contribution n'est pas encore configuré.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Requête invalide.");
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Requête invalide.");
  }

  const { proposalId, uploadSecret, index } = parsed.data;
  const path = `proposals/${proposalId}/${uploadSecret}/upload-${index}-${randomUUID()}`;

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.storage
    .from("spot-originals")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return errorResponse("Impossible de préparer l'envoi de cette photo.", 500);
  }

  return NextResponse.json({ ok: true, path: data.path, token: data.token });
}
