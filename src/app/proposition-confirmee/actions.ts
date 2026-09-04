"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendProposalConfirmationEmail } from "@/features/proposals/server/confirmation-email";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";

const confirmationSchema = z.object({ token: z.string().min(40).max(200) });
const resendSchema = z.object({
  trackingId: z.string().trim().regex(/^SPT-[A-Z0-9]{10}$/),
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
});

function hashCapability(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function confirmProposalEmailAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/proposition-confirmee?confirme=erreur");
  const parsed = confirmationSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) redirect("/proposition-confirmee?confirme=erreur");

  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.rpc("confirm_proposal_email", {
    p_token: parsed.data.token,
  });
  const proposal = data?.[0];
  if (error || !proposal) redirect("/proposition-confirmee?confirme=erreur");

  redirect(`/proposition-confirmee?confirme=oui&suivi=${encodeURIComponent(proposal.tracking_id)}`);
}

export async function resendProposalConfirmationAction(formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/proposition-confirmee?renvoi=erreur");
  const parsed = resendSchema.safeParse({
    trackingId: formData.get("trackingId"),
    email: formData.get("email"),
  });
  if (!parsed.success) redirect("/proposition-confirmee?renvoi=erreur");

  const token = randomBytes(32).toString("base64url");
  const supabase = createSupabasePublicServerClient();
  const { data: proposalId, error } = await supabase.rpc("refresh_proposal_confirmation", {
    p_tracking_id: parsed.data.trackingId,
    p_email: parsed.data.email,
    p_email_token_hash: hashCapability(token),
  });
  if (error || !proposalId) {
    redirect(`/proposition-confirmee?renvoi=attente&suivi=${encodeURIComponent(parsed.data.trackingId)}`);
  }

  const emailResult = await sendProposalConfirmationEmail({
    email: parsed.data.email,
    trackingId: parsed.data.trackingId,
    token,
  });
  const params = new URLSearchParams({
    suivi: parsed.data.trackingId,
    renvoi: emailResult.sent ? "oui" : "erreur",
  });
  if (emailResult.developmentConfirmationUrl) params.set("jeton", token);
  redirect(`/proposition-confirmee?${params.toString()}`);
}

