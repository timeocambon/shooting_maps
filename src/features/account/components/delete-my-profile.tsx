"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type DeleteMyProfileProps = {
  photographerName: string;
  photoIds: string[];
};

export function DeleteMyProfile({ photographerName, photoIds }: DeleteMyProfileProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Supprimer définitivement votre fiche « ${photographerName} » ? Vos photos et les avis reçus seront effacés. Votre compte, lui, est conservé.`,
    );
    if (!confirmed) return;

    setError(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Les fichiers d'abord : une fois la fiche supprimée, le stockage ne
      // reconnaît plus le propriétaire et refuserait l'effacement.
      for (const photoId of photoIds) {
        const { data: path } = await supabase.rpc("remove_my_photographer_photo", { p_photo_id: photoId });
        if (path) await supabase.storage.from("photographer-photos").remove([path]);
      }

      const { error: deleteError } = await supabase.rpc("delete_my_photographer_profile");
      if (deleteError) throw deleteError;

      router.push("/mon-espace");
      router.refresh();
    } catch {
      setError("La suppression a échoué. Réessayez dans quelques instants.");
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone">
      <h2>Supprimer ma fiche</h2>
      <p>
        Votre fiche, ses photos et les avis reçus seront définitivement effacés. Votre compte reste actif : vous
        pourrez créer une nouvelle fiche plus tard.
      </p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button type="button" className="button danger-button" onClick={handleDelete} disabled={busy}>
        <Trash2 size={16} aria-hidden="true" /> {busy ? "Suppression…" : "Supprimer ma fiche"}
      </button>
    </section>
  );
}
