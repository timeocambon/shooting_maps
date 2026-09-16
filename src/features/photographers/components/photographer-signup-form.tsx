"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Send, Trash2, Upload } from "lucide-react";
import {
  photographerSignupSchema,
  socialPlatformLabels,
  socialPlatforms,
  type SocialPlatform,
} from "@/features/photographers/domain/photographer";
// Client lié aux cookies de session : si la personne est connectée, la fiche
// créée lui appartient immédiatement (owner_user_id).
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type SocialRow = { platform: SocialPlatform; value: string };
type PhotoItem = { file: File; previewUrl: string };

function extensionFor(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function PhotographerSignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [socials, setSocials] = useState<SocialRow[]>([{ platform: "instagram", value: "" }]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  function updateSocial(index: number, patch: Partial<SocialRow>) {
    setSocials((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addSocial() {
    if (socials.length >= 5) return;
    setSocials((current) => [...current, { platform: "instagram", value: "" }]);
  }

  function removeSocial(index: number) {
    setSocials((current) => current.filter((_, i) => i !== index));
  }

  function addPhotos(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    const incoming = Array.from(fileList);
    const accepted: PhotoItem[] = [];

    for (const file of incoming) {
      if (photos.length + accepted.length >= MAX_PHOTOS) break;
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Seules les images JPEG, PNG ou WebP sont acceptées.");
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError("Chaque image doit faire moins de 6 Mo.");
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    if (accepted.length) setPhotos((current) => [...current, ...accepted]);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = photographerSignupSchema.safeParse({
      name,
      tagline,
      bio,
      locationLabel,
      socials: socials.filter((row) => row.value.trim().length > 0),
      email,
      website,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Certains champs sont incomplets.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: photographerId, error: createError } = await supabase.rpc("create_public_photographer", {
        p_name: parsed.data.name,
        p_tagline: parsed.data.tagline,
        p_bio: parsed.data.bio,
        p_location_label: parsed.data.locationLabel,
        p_socials: parsed.data.socials,
        p_email: parsed.data.email,
        p_website: parsed.data.website,
      });

      if (createError || !photographerId) {
        throw new Error(createError?.message ?? "unknown");
      }

      for (let index = 0; index < photos.length; index += 1) {
        const { file } = photos[index];
        const objectPath = `photographers/${photographerId}/${crypto.randomUUID()}.${extensionFor(file)}`;
        const { error: uploadError } = await supabase.storage
          .from("photographer-photos")
          .upload(objectPath, file, { contentType: file.type });
        if (uploadError) continue;

        const { data: publicUrlData } = supabase.storage.from("photographer-photos").getPublicUrl(objectPath);
        await supabase.rpc("attach_photographer_photo", {
          p_photographer_id: photographerId,
          p_object_path: objectPath,
          p_public_url: publicUrlData.publicUrl,
          p_display_order: index,
        });
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Votre inscription n’a pas pu être envoyée. Réessayez dans quelques instants.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <section className="report-confirmation" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <p className="kicker">Inscription transmise</p>
        <h1>Merci, votre profil est en cours de vérification.</h1>
        <p>Il apparaîtra dans l’annuaire des photographes dès qu’il aura été validé par l’équipe.</p>
      </section>
    );
  }

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      <label>
        Nom ou nom de studio
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
      </label>

      <label>
        Présentation courte
        <span>Une phrase qui donne envie de découvrir votre travail (10 à 160 caractères).</span>
        <input value={tagline} onChange={(event) => setTagline(event.target.value)} maxLength={160} required />
      </label>

      <label>
        À propos de vous
        <span>Votre parcours, votre style, ce que vous proposez (20 à 2 000 caractères).</span>
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={6} maxLength={2000} required />
      </label>

      <label>
        Zone géographique <span>facultatif</span>
        <input
          value={locationLabel}
          onChange={(event) => setLocationLabel(event.target.value)}
          maxLength={120}
          placeholder="ex. Toulouse et alentours"
        />
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
                <option key={platform} value={platform}>
                  {socialPlatformLabels[platform]}
                </option>
              ))}
            </select>
            <input
              value={row.value}
              onChange={(event) => updateSocial(index, { value: event.target.value })}
              placeholder="@pseudo ou lien complet"
              maxLength={200}
            />
            {socials.length > 1 ? (
              <button type="button" className="icon-button" onClick={() => removeSocial(index)} aria-label="Retirer ce réseau">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
        {socials.length < 5 ? (
          <button type="button" className="button button-small button-secondary" onClick={addSocial}>
            <Plus size={15} aria-hidden="true" /> Ajouter un réseau
          </button>
        ) : null}
      </fieldset>

      <fieldset>
        <legend>Quelques photos {`(${photos.length}/${MAX_PHOTOS})`}</legend>
        <div className="photo-picker-grid">
          {photos.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <div className="photo-picker-item" key={photo.previewUrl}>
              <img src={photo.previewUrl} alt="" />
              <button type="button" onClick={() => removePhoto(index)} aria-label="Retirer cette photo">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <label className="photo-picker-add">
              <Upload size={20} aria-hidden="true" />
              <span>Ajouter</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  addPhotos(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </fieldset>

      <label>
        Adresse e-mail
        <span>Utilisée uniquement pour vous recontacter au sujet de votre profil.</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required maxLength={320} />
      </label>

      <label className="website-field" aria-hidden="true">
        Site web
        <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
      </label>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <div className="publish-row">
        <p>Votre profil est vérifié avant de devenir visible dans l’annuaire.</p>
        <button className="button" type="submit" disabled={pending}>
          <Send size={17} aria-hidden="true" /> {pending ? "Envoi…" : "Envoyer mon inscription"}
        </button>
      </div>
    </form>
  );
}
