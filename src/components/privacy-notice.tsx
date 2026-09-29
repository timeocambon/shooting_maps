import Link from "next/link";
import { ShieldCheck } from "lucide-react";

type PrivacyNoticeProps = {
  /** À quoi servent les données saisies dans ce formulaire précis. */
  purpose: string;
  /** Combien de temps elles sont conservées. */
  retention: string;
};

/**
 * Information RGPD affichée au pied des formulaires qui collectent des données
 * personnelles. Le règlement demande que la finalité et la durée soient connues
 * au moment de la saisie, pas seulement dans une page à part.
 */
export function PrivacyNotice({ purpose, retention }: PrivacyNoticeProps) {
  return (
    <p className="privacy-notice">
      <ShieldCheck size={15} aria-hidden="true" />
      <span>
        {purpose} {retention} Vous pouvez en demander la suppression à tout moment. Détail dans la{" "}
        <Link href="/confidentialite">politique de confidentialité</Link>.
      </span>
    </p>
  );
}
