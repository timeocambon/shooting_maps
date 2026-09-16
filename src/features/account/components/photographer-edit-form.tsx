"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  socialPlatformLabels,
  socialPlatforms,
  type SocialLink,
  type SocialPlatform,
} from "@/features/photographers/domain/photographer";
import {
  updateMyPhotographerProfileAction,
  type ProfileEditState,
} from "@/app/mon-espace/fiche/actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const initialState: ProfileEditState = { status: "idle" };

type ExistingPhoto = { id: string; public_url: string; display_order: number; moderation_state: string };

type PhotographerEditFormProps = {
  photographerId: string;
  name: string;
  tagline: string;
  bio: string;
  locationLabel: string;
  socials: SocialLink[];
  photos: ExistingPhoto[];
};

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function PhotographerEditForm({
  photographerId,
  name,
  tagline,
  bio,
  locationLabel,
  socials: initialSocials,
  photos,
}: PhotographerEditFormProps) {
  const router = useRouter();
  const [socials, setSocials] = useState<SocialLink[]>(
    initialSocials.length ? initialSocials : [{ platform: "instagram", value: "" }],
  );
  const [state, formAction, pending] = useActionState(updateMyPhotographerProfileAction, initialState);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function updateSocial(index: number, patch: Partial<SocialLink>) {
    setSocials((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError("Seules les images JPEG, PNG ou WebP sont acceptées.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Chaque image doit faire moins de 6 Mo.");
      return;
    }

    setPhotoBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const objectPath = `photographers/${photographerId}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage
        .from("photographer-photos")
        .upload(objectPath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("photographer-photos").getPublicUrl(objectPath);
      const { error: attachError } = await supabase.rpc("add_my_photographer_photo", {
        p_object_path: objectPath,
        p_public_url: publicUrlData.publicUrl,
      });
      if (attachError) throw attachError;

      router.refresh();
    } catch {
      setPhotoError("L’ajout de la photo a échoué. Réessayez dans quelques instants.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto(photoId: string) {
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: removedPath, error } = await supabase.rpc("remove_my_photographer_photo", {
        p_photo_id: photoId,
      });
      if (error) throw error;
      if (removedPath) {
        await supabase.storage.from("photographer-photos").remove([removedPath]);
      }
      router.refresh();
    } catch {
      setPhotoError("La suppression a échoué. Réessayez dans quelques instants.");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <>
      <form className="report-form" action={formAction}>
        <label>
          Nom ou nom de studio
          <input name="name" defaultValue={name} maxLength={80} required />
        </label>

        <label>
          Présentation courte
          <span>10 à 160 caractères.</span>
          <input name="tagline" defaultValue={tagline} maxLength={160} required />
        </label>

        <label>
          À propos de vous
          <span>20 à 2 000 caractères.</span>
          <textarea name="bio" defaultValue={bio} rows={6} maxLength={2000} required />
        </label>

        <label>
          Zone géographique <span>facultatif</span>
          <input name="locationLabel" defaultValue={locationLabel} maxLength={120} placeholder="ex. Toulouse et alentours" />
        </label>

        <fieldset>
          <legend>Réseaux sociaux</legend>
          {socials.map((row, index) => (
            <div className="social-row" key={index}>
              <select
                value={row.platform}
                onChange={(event) => updateSocial(index, { platform: event.target.value as SocialPlatform })}
              >
                {socialPlatforms.map((platform) => (
                  <option key={platform} value={platform}>{socialPlatformLabels[platform]}</option>
                ))}
              </select>
              <input
                value={row.value}
                onChange={(event) => updateSocial(index, { value: event.target.value })}
                placeholder="@pseudo ou lien complet"
                maxLength={200}
              />
              {socials.length > 1 ? (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setSocials((current) => current.filter((_, i) => i !== index))}
                  aria-label="Retirer ce réseau"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ))}
          {socials.length < 5 ? (
            <button
              type="button"
              className="button button-small button-secondary"
              onClick={() => setSocials((current) => [...current, { platform: "instagram", value: "" }])}
            >
              <Plus size={15} aria-hidden="true" /> Ajouter un réseau
            </button>
          ) : null}
          <input type="hidden" name="socials" value={JSON.stringify(socials.filter((row) => row.value.trim()))} />
        </fieldset>

        {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
        {state.status === "success" ? (
          <p className="success-message" role="status"><CheckCircle2 size={16} aria-hidden="true" /> Modifications enregistrées.</p>
        ) : null}

        <div className="publish-row">
          <p>Vos modifications sont visibles immédiatement sur votre page publique.</p>
          <button className="button" type="submit" disabled={pending}>
            <Save size={17} aria-hidden="true" /> {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>

      <section className="reviews-section">
        <h2>Mes photos ({photos.length}/{MAX_PHOTOS})</h2>
        {photoError ? <p className="form-error" role="alert">{photoError}</p> : null}
        <div className="photo-picker-grid">
          {photos.map((photo) => (
            <div className="photo-picker-item" key={photo.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.public_url} alt="" />
              <button type="button" onClick={() => removePhoto(photo.id)} disabled={photoBusy} aria-label="Supprimer cette photo">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <label className="photo-picker-add">
              <Upload size={20} aria-hidden="true" />
              <span>{photoBusy ? "Envoi…" : "Ajouter"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={photoBusy}
                onChange={(event) => {
                  addPhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </section>
    </>
  );
}
