"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Star, Trash2, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { prepareImageForUpload } from "@/lib/image-processing";

export type AdminSpotPhoto = {
  id: string;
  publicUrl: string | null;
  publishedObjectPath: string | null;
  displayOrder: number;
  moderationState: string;
  altText: string | null;
};

type SpotPhotoManagerProps = {
  spotId: string;
  photos: AdminSpotPhoto[];
};

const MAX_PHOTOS = 6;
// Le compartiment « spot-published » n'accepte que ces deux formats.
const ALLOWED_TYPES = ["image/jpeg", "image/webp"];

export function SpotPhotoManager({ spotId, photos }: SpotPhotoManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      router.refresh();
    } catch (cause) {
      console.error("[SpotPhotoManager]", cause);
      setError("L’opération a échoué. Rechargez la page et réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function addPhoto(file: File | undefined) {
    if (!file) return;
    void run(async () => {
      // Réduite et réencodée : même traitement que les photos reçues par le
      // formulaire public, métadonnées EXIF comprises.
      const { file: prepared } = await prepareImageForUpload(file, { forceReencode: true });
      if (!ALLOWED_TYPES.includes(prepared.type)) {
        throw new Error(`format refusé : ${prepared.type}`);
      }

      const supabase = createSupabaseBrowserClient();
      const extension = prepared.type === "image/jpeg" ? "jpg" : "webp";
      const objectPath = `spots/${spotId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("spot-published")
        .upload(objectPath, prepared, { contentType: prepared.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("spot-published").getPublicUrl(objectPath);
      const { error: attachError } = await supabase.rpc("admin_add_spot_photo", {
        p_spot_id: spotId,
        p_object_path: objectPath,
        p_public_url: publicUrlData.publicUrl,
      });
      if (attachError) throw attachError;
    });
  }

  function removePhoto(photo: AdminSpotPhoto) {
    void run(async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: deleteError } = await supabase.rpc("admin_delete_spot_photo", {
        p_photo_id: photo.id,
      });
      if (deleteError) throw deleteError;

      // Les fichiers sont retirés après coup : Supabase interdit la
      // suppression directe dans storage.objects depuis SQL.
      const row = data?.[0];
      if (row?.published_path) {
        await supabase.storage.from("spot-published").remove([row.published_path]);
      }
      if (row?.original_path) {
        await supabase.storage.from("spot-originals").remove([row.original_path]);
      }
    });
  }

  function reorder(nextIds: string[]) {
    void run(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: reorderError } = await supabase.rpc("admin_reorder_spot_photos", {
        p_spot_id: spotId,
        p_photo_ids: nextIds,
      });
      if (reorderError) throw reorderError;
    });
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const nextIds = photos.map((photo) => photo.id);
    [nextIds[index], nextIds[target]] = [nextIds[target], nextIds[index]];
    reorder(nextIds);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    const nextIds = photos.map((photo) => photo.id);
    const [moved] = nextIds.splice(index, 1);
    reorder([moved, ...nextIds]);
  }

  function toggleVisibility(photo: AdminSpotPhoto) {
    void run(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: stateError } = await supabase.rpc("admin_set_spot_photo_state", {
        p_photo_id: photo.id,
        p_moderation_state: photo.moderationState === "approved" ? "hidden" : "approved",
      });
      if (stateError) throw stateError;
    });
  }

  return (
    <section className="admin-photo-manager">
      <header>
        <h2>Photos de la fiche</h2>
        <p>
          {photos.length}/{MAX_PHOTOS} · la première sert de vignette sur la carte et dans les listes.
        </p>
      </header>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="admin-photo-grid">
        {photos.map((photo, index) => (
          <figure className={`admin-photo-item${photo.moderationState === "approved" ? "" : " is-hidden"}`} key={photo.id}>
            {photo.publicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.publicUrl} alt={photo.altText ?? ""} />
            ) : (
              <span className="admin-photo-missing">Aperçu indisponible</span>
            )}
            <figcaption>
              {index === 0 ? <span className="admin-photo-badge">Couverture</span> : null}
              {photo.moderationState !== "approved" ? <span className="admin-photo-badge muted">Masquée</span> : null}
            </figcaption>
            <div className="admin-photo-actions">
              <button type="button" onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label="Déplacer vers la gauche">
                <ArrowLeft size={15} />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={busy || index === photos.length - 1} aria-label="Déplacer vers la droite">
                <ArrowRight size={15} />
              </button>
              <button type="button" onClick={() => makeCover(index)} disabled={busy || index === 0} aria-label="Définir comme couverture">
                <Star size={15} />
              </button>
              <button type="button" onClick={() => toggleVisibility(photo)} disabled={busy} aria-label={photo.moderationState === "approved" ? "Masquer cette photo" : "Réafficher cette photo"}>
                {photo.moderationState === "approved" ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button type="button" className="danger" onClick={() => removePhoto(photo)} disabled={busy} aria-label="Supprimer définitivement cette photo">
                <Trash2 size={15} />
              </button>
            </div>
          </figure>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <label className="admin-photo-add">
            <Upload size={20} aria-hidden="true" />
            <span>{busy ? "Traitement…" : "Ajouter une photo"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                addPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      <p className="admin-photo-hint">
        Les photos sont réduites à 2000 px et converties en WebP avant l’envoi ; leurs métadonnées,
        dont la position GPS de la prise de vue, sont supprimées au passage. La suppression est
        définitive, contrairement au masquage.
      </p>
    </section>
  );
}
