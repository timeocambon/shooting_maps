import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MfaChallenge } from "@/features/admin/mfa-challenge";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Sécurité administrateur" };

export default function SecurityPage() {
  return (
    <main className="admin-gate">
      <section>
        <Link className="back-link" href="/admin"><ArrowLeft size={17} /> Retour</Link>
        <MfaChallenge configured={isSupabaseConfigured()} />
      </section>
    </main>
  );
}
