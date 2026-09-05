"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { LocationPicker } from "@/features/proposals/components/location-picker";
import {
  categoryLabels,
  spotCategories,
  type SpotCategory,
} from "@/features/spots/domain/spot";
import { createSupabasePublicBrowserClient } from "@/lib/supabase/public-browser";

const DRAFT_KEY = "spotride:proposal-draft:v1";
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
const stepNames = ["Localisation", "Identité", "Accès", "Photos", "Validation"];

type Draft = {
  address: string;
  latitude: string;
  longitude: string;
  locationConfirmed: boolean;
  municipality: string;
  postalCode: string;
  displayPrecision: "exact" | "approximate";
  accessWithoutTrespass: boolean;
  name: string;
  categories: SpotCategory[];
  shortDescription: string;
  bestTimes: Array<"morning" | "day" | "golden_hour" | "sunset" | "night">;
  visualFeatures: string;
  accessLevel: "easy" | "intermediate" | "difficult";
  parking: string;
  walkingApproach: string;
  surfaceType: "asphalt" | "gravel" | "earth" | "mixed";
  traffic: string;
  attendance: "quiet" | "variable" | "busy";
  risks: string;
  locationStatus: "public" | "private_with_permission" | "to_confirm" | "sensitive";
  photoCredit: string;
  rightsDeclared: boolean;
  peopleConfirmed: boolean;
  email: string;
  pseudonym: string;
  charterAccepted: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

const initialDraft: Draft = {
  address: "",
  latitude: "43.6045",
  longitude: "1.4442",
  locationConfirmed: false,
  municipality: "Toulouse",
  postalCode: "31000",
  displayPrecision: "exact",
  accessWithoutTrespass: false,
  name: "",
  categories: [],
  shortDescription: "",
  bestTimes: [],
  visualFeatures: "",
  accessLevel: "easy",
  parking: "",
  walkingApproach: "",
  surfaceType: "asphalt",
  traffic: "",
  attendance: "variable",
  risks: "",
  locationStatus: "to_confirm",
  photoCredit: "",
  rightsDeclared: false,
  peopleConfirmed: false,
  email: "",
  pseudonym: "",
  charterAccepted: false,
  termsAccepted: false,
  privacyAccepted: false,
};

type ApiResponse = {
  ok: boolean;
  message?: string;
  trackingId?: string;
  emailSent?: boolean;
  developmentConfirmationUrl?: string | null;
};

type CreateProposalResponse = {
  ok: boolean;
  message?: string;
  proposalId?: string;
  trackingId?: string;
  uploadSecret?: string;
  emailToken?: string;
};

type SignPhotoResponse = {
  ok: boolean;
  message?: string;
  path?: string;
  token?: string;
};

type GeocodingResult = {
  label: string;
  municipality: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  score: number;
};

type GeocodingResponse = {
  ok: boolean;
  message?: string;
  results?: GeocodingResult[];
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("unreadable_image"));
    };
    image.src = objectUrl;
  });
}

function isDraft(value: unknown): value is Draft {
  return Boolean(value && typeof value === "object" && "name" in value && "latitude" in value);
}

export function ProposalWizard({ mapStyleUrl }: { mapStyleUrl: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoSelectionMessage, setPhotoSelectionMessage] = useState("");
  const [photoSelectionError, setPhotoSelectionError] = useState(false);
  const [checkingPhotos, setCheckingPhotos] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitStage, setSubmitStage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [website, setWebsite] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingMessage, setGeocodingMessage] = useState("");
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as { expiresAt?: number; value?: unknown };
          if (saved.expiresAt && saved.expiresAt > Date.now() && isDraft(saved.value)) {
            setDraft({ ...initialDraft, ...saved.value });
          } else {
            window.localStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ version: 1, expiresAt: Date.now() + DRAFT_TTL, value: draft }),
      );
    } catch {
      // The form remains usable when storage is blocked by the browser.
    }
  }, [draft, hydrated]);

  const summary = useMemo(
    () => [
      `${draft.address || draft.municipality || "Adresse à préciser"} · ${draft.displayPrecision === "exact" ? "position exacte" : "position approximative"}`,
      draft.name || "Nom à préciser",
      `${draft.parking ? "stationnement renseigné" : "stationnement à préciser"} · ${draft.risks ? "risques renseignés" : "risques à préciser"}`,
      `${photos.length} photo${photos.length > 1 ? "s" : ""}`,
      draft.email || "E-mail à préciser",
    ],
    [draft, photos.length],
  );

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyGeocodingResult(result: GeocodingResult) {
    setDraft((current) => ({
      ...current,
      address: result.label,
      municipality: result.municipality || current.municipality,
      postalCode: result.postalCode || current.postalCode,
      latitude: String(result.latitude),
      longitude: String(result.longitude),
      locationConfirmed: true,
    }));
    setGeocodingMessage("Adresse localisée. Ajustez le repère sur la carte si nécessaire.");
    setAddressResults([]);
  }

  async function locateAddress() {
    const address = draft.address.trim();
    if (address.length < 5 || geocoding) {
      setGeocodingMessage("Saisissez une adresse ou un lieu plus précis.");
      return;
    }

    setGeocoding(true);
    setGeocodingMessage("");
    setAddressResults([]);

    try {
      const response = await fetch(
        `/api/geocodage?adresse=${encodeURIComponent(address)}`,
      );
      const result = (await response.json()) as GeocodingResponse;
      const matches = result.results ?? [];

      if (!response.ok || !result.ok) {
        setGeocodingMessage(
          result.message ?? "La recherche d’adresse n’a pas abouti.",
        );
      } else if (!matches.length) {
        setGeocodingMessage(
          "Adresse introuvable. Complétez-la ou placez directement le repère sur la carte.",
        );
      } else {
        applyGeocodingResult(matches[0]);
        setAddressResults(matches.slice(1));
      }
    } catch {
      setGeocodingMessage(
        "La recherche d’adresse est indisponible. Placez directement le repère sur la carte.",
      );
    } finally {
      setGeocoding(false);
    }
  }

  function validate(currentStep: number): string[] {
    if (currentStep === 0) {
      const latitude = Number(draft.latitude);
      const longitude = Number(draft.longitude);
      return [
        ...(draft.address.trim().length < 5 ? ["Indiquez l’adresse ou le nom du lieu."] : []),
        ...(!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ? ["Indiquez une latitude valide."] : []),
        ...(!Number.isFinite(longitude) || longitude < -180 || longitude > 180 ? ["Indiquez une longitude valide."] : []),
        ...(!draft.locationConfirmed ? ["Localisez l’adresse ou placez le repère sur la carte."] : []),
        ...(draft.municipality.trim().length < 2 ? ["Indiquez la commune."] : []),
        ...(!/^\d{5}$/.test(draft.postalCode) ? ["Indiquez un code postal à cinq chiffres."] : []),
        ...(!draft.accessWithoutTrespass ? ["Confirmez que l'accès ne nécessite aucune intrusion."] : []),
      ];
    }
    if (currentStep === 1) {
      return [
        ...(draft.name.trim().length < 3 ? ["Donnez un nom au spot."] : []),
        ...(draft.categories.length < 1 ? ["Choisissez au moins un type de décor."] : []),
        ...(draft.shortDescription.trim().length < 20 ? ["Décrivez l'ambiance en au moins 20 caractères."] : []),
        ...(draft.bestTimes.length < 1 ? ["Choisissez au moins un moment conseillé."] : []),
      ];
    }
    if (currentStep === 2) {
      return [
        ...(draft.parking.trim().length < 3 ? ["Précisez le stationnement."] : []),
        ...(draft.walkingApproach.trim().length < 3 ? ["Précisez l'approche à pied."] : []),
        ...(draft.traffic.trim().length < 3 ? ["Décrivez la circulation."] : []),
        ...(draft.risks.trim().length < 10 ? ["Décrivez clairement les risques et restrictions."] : []),
      ];
    }
    if (currentStep === 3) {
      return [
        ...(photos.length < 2 || photos.length > 6 ? ["Ajoutez entre 2 et 6 photos."] : []),
        ...(photos.some((photo) => photo.size > 15 * 1024 * 1024) ? ["Chaque photo doit peser moins de 15 Mo."] : []),
        ...(!draft.rightsDeclared ? ["Confirmez vos droits de diffusion."] : []),
        ...(!draft.peopleConfirmed ? ["Confirmez la situation des personnes reconnaissables."] : []),
      ];
    }
    return [
      ...(!/^\S+@\S+\.\S+$/.test(draft.email) ? ["Indiquez une adresse e-mail valide."] : []),
      ...(!draft.charterAccepted ? ["Acceptez la charte de contribution."] : []),
      ...(!draft.termsAccepted ? ["Acceptez les conditions de contribution."] : []),
      ...(!draft.privacyAccepted ? ["Confirmez avoir lu l'information sur les données personnelles."] : []),
    ];
  }

  function continueToNextStep() {
    const nextErrors = validate(step);
    setErrors(nextErrors);
    if (nextErrors.length) return;
    setStep((current) => Math.min(current + 1, stepNames.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCategory(category: SpotCategory) {
    update(
      "categories",
      draft.categories.includes(category)
        ? draft.categories.filter((item) => item !== category)
        : draft.categories.length < 3
          ? [...draft.categories, category]
          : draft.categories,
    );
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    setPhotos((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function addPhotos(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    const existingKeys = new Set(
      photos.map((photo) => `${photo.name}-${photo.size}-${photo.lastModified}`),
    );
    const uniqueIncoming = incoming.filter((photo) => {
      const key = `${photo.name}-${photo.size}-${photo.lastModified}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const availableSlots = Math.max(0, 6 - photos.length);
    const candidates = uniqueIncoming.slice(0, availableSlots);
    const accepted: File[] = [];
    const rejected: string[] = [];

    setCheckingPhotos(true);
    setPhotoSelectionError(false);

    for (const photo of candidates) {
      if (photo.size > 15 * 1024 * 1024) {
        rejected.push(`${photo.name} dépasse 15 Mo`);
        continue;
      }

      try {
        const { width, height } = await readImageDimensions(photo);
        if (width < 1000 || height < 600) {
          rejected.push(`${photo.name} (${width} × ${height} px)`);
        } else {
          accepted.push(photo);
        }
      } catch {
        rejected.push(`${photo.name} est illisible ou n’est pas une image compatible`);
      }
    }

    const nextCount = photos.length + accepted.length;

    setPhotos((current) => [...current, ...accepted]);
    setCheckingPhotos(false);

    const messages: string[] = [];
    if (rejected.length) {
      messages.push(`Photos refusées (minimum 1000 × 600 px) : ${rejected.join(", ")}.`);
    }
    if (uniqueIncoming.length > availableSlots) {
      messages.push("La limite de 6 photos est atteinte ; les images supplémentaires n’ont pas été ajoutées.");
    }
    if (!uniqueIncoming.length) {
      messages.push("Ces photos sont déjà dans la sélection.");
    } else if (accepted.length) {
      messages.push(
        nextCount === 6
          ? "6 photos valides sélectionnées."
          : `${nextCount} photo${nextCount > 1 ? "s" : ""} valide${nextCount > 1 ? "s" : ""} sélectionnée${nextCount > 1 ? "s" : ""}.`,
      );
    }

    setPhotoSelectionError(rejected.length > 0);
    setPhotoSelectionMessage(messages.join(" "));
  }

  async function submitProposal() {
    const nextErrors = validate(4);
    setErrors(nextErrors);
    if (nextErrors.length || submitting) return;
    setSubmitting(true);
    setSubmitStage("Création de la proposition…");

    let proposalId: string | undefined;
    let uploadSecret: string | undefined;

    try {
      // 1/3 — crée la proposition (texte uniquement). Les photos ne passent
      // jamais par cette requête : elles sont envoyées directement à Supabase
      // Storage ci-dessous, pour ne pas dépasser la limite de 4,5 Mo des
      // fonctions Vercel.
      const createResponse = await fetch("/api/propositions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          payload: {
            address: draft.address,
            latitude: Number(draft.latitude), longitude: Number(draft.longitude),
            municipality: draft.municipality, postalCode: draft.postalCode,
            displayPrecision: draft.displayPrecision, accessWithoutTrespass: draft.accessWithoutTrespass,
            name: draft.name, categories: draft.categories, shortDescription: draft.shortDescription,
            bestTimes: draft.bestTimes, visualFeatures: draft.visualFeatures,
            accessLevel: draft.accessLevel, parking: draft.parking, walkingApproach: draft.walkingApproach,
            surfaceType: draft.surfaceType, traffic: draft.traffic, attendance: draft.attendance,
            risks: draft.risks, locationStatus: draft.locationStatus,
          },
          email: draft.email,
          pseudonym: draft.pseudonym,
          photoCredit: draft.photoCredit,
          rightsDeclared: draft.rightsDeclared,
          peopleConfirmed: draft.peopleConfirmed,
          charterAccepted: draft.charterAccepted,
          termsAccepted: draft.termsAccepted,
          privacyAccepted: draft.privacyAccepted,
          website,
        }),
      });
      const created = (await createResponse.json()) as CreateProposalResponse;
      if (
        !createResponse.ok ||
        !created.ok ||
        !created.proposalId ||
        !created.uploadSecret ||
        !created.trackingId ||
        !created.emailToken
      ) {
        setErrors([created.message ?? "La proposition n'a pas pu être envoyée."]);
        setSubmitting(false);
        setSubmitStage("");
        return;
      }

      proposalId = created.proposalId;
      uploadSecret = created.uploadSecret;
      const { trackingId, emailToken } = created;

      // 2/3 — envoie chaque photo directement à Supabase Storage via une URL
      // signée (le fichier ne transite pas par une fonction Vercel).
      const supabase = createSupabasePublicBrowserClient();
      const uploadedPhotos: Array<{ path: string; index: number }> = [];

      for (const [index, photo] of photos.entries()) {
        setSubmitStage(`Envoi de la photo ${index + 1}/${photos.length}…`);

        const signResponse = await fetch("/api/propositions/photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId, uploadSecret, index }),
        });
        const signed = (await signResponse.json()) as SignPhotoResponse;
        if (!signResponse.ok || !signed.ok || !signed.path || !signed.token) {
          throw new Error(signed.message ?? "upload_failed");
        }

        const { error: uploadError } = await supabase.storage
          .from("spot-originals")
          .uploadToSignedUrl(signed.path, signed.token, photo);
        if (uploadError) throw new Error("upload_failed");

        uploadedPhotos.push({ path: signed.path, index });
      }

      // 3/3 — traite les photos côté serveur (comme avant) et finalise.
      setSubmitStage("Finalisation…");
      const finalizeResponse = await fetch("/api/propositions/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId,
          uploadSecret,
          emailToken,
          trackingId,
          email: draft.email,
          photoCredit: draft.photoCredit,
          photos: uploadedPhotos,
        }),
      });
      const result = (await finalizeResponse.json()) as ApiResponse;
      if (!finalizeResponse.ok || !result.ok || !result.trackingId) {
        setErrors([result.message ?? "La proposition n'a pas pu être envoyée."]);
        setSubmitting(false);
        setSubmitStage("");
        return;
      }

      window.localStorage.removeItem(DRAFT_KEY);
      const params = new URLSearchParams({ suivi: result.trackingId });
      if (!result.emailSent) params.set("email", "echec");
      if (result.developmentConfirmationUrl) {
        const token = new URL(result.developmentConfirmationUrl).searchParams.get("jeton");
        if (token) params.set("jeton", token);
      }
      router.push(`/proposition-confirmee?${params.toString()}`);
    } catch {
      if (proposalId && uploadSecret) {
        try {
          const supabase = createSupabasePublicBrowserClient();
          await supabase.rpc("abandon_public_proposal", {
            p_proposal_id: proposalId,
            p_upload_secret: uploadSecret,
          });
        } catch {
          // Best-effort cleanup only ; la proposition sera de toute façon
          // ignorée par la modération tant qu'elle n'est pas confirmée.
        }
      }
      setErrors(["La connexion a été interrompue. Votre brouillon est conservé."]);
      setSubmitting(false);
      setSubmitStage("");
    }
  }

  return (
    <section className="proposal-wizard">
      <ol className="wizard-progress" aria-label="Progression de la proposition">
        {stepNames.map((name, index) => (
          <li key={name} className={index === step ? "current" : index < step ? "done" : ""} aria-current={index === step ? "step" : undefined}>
            <span>{index < step ? <Check size={15} /> : index + 1}</span><small>{name}</small>
          </li>
        ))}
      </ol>

      <div className="wizard-layout">
        <div className="wizard-card">
          <p className="step-number">Étape {step + 1} sur 5</p>
          {step === 0 ? (
            <fieldset>
              <legend><MapPin /> Où se trouve le spot ?</legend>
              <p className="fieldset-intro">Saisissez une adresse pour placer automatiquement le repère, puis ajustez-le sur la carte si nécessaire. La position exacte reste privée tant que la modération n&apos;est pas terminée.</p>
              <div className="address-search-block">
                <label htmlFor="spot-address">Adresse ou nom du lieu</label>
                <div className="address-search-row">
                  <input
                    id="spot-address"
                    value={draft.address}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        address: event.target.value,
                        locationConfirmed: false,
                      }));
                      setGeocodingMessage("");
                      setAddressResults([]);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void locateAddress();
                      }
                    }}
                    placeholder="Ex. 12 rue des Arts, 31000 Toulouse"
                    autoComplete="street-address"
                  />
                  <button
                    className="button"
                    type="button"
                    onClick={() => void locateAddress()}
                    disabled={geocoding}
                  >
                    {geocoding ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}
                    {geocoding ? "Recherche…" : "Localiser"}
                  </button>
                </div>
                {geocodingMessage ? <p className="address-search-message" role="status">{geocodingMessage}</p> : null}
                {addressResults.length ? (
                  <div className="address-results" aria-label="Autres adresses possibles">
                    <span>Autres résultats :</span>
                    {addressResults.map((result) => (
                      <button key={`${result.label}-${result.longitude}-${result.latitude}`} type="button" onClick={() => applyGeocodingResult(result)}>
                        {result.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <LocationPicker
                latitude={Number(draft.latitude) || 43.6045}
                longitude={Number(draft.longitude) || 1.4442}
                onChange={(latitude, longitude) => {
                  setDraft((current) => ({
                    ...current,
                    latitude: String(latitude),
                    longitude: String(longitude),
                    locationConfirmed: true,
                  }));
                }}
                styleUrl={mapStyleUrl}
              />
              <div className="form-grid">
                <label>Commune<input value={draft.municipality} onChange={(event) => update("municipality", event.target.value)} required /></label>
                <label>Code postal<input inputMode="numeric" value={draft.postalCode} onChange={(event) => update("postalCode", event.target.value)} required /></label>
                <details className="coordinate-details field-wide">
                  <summary>Coordonnées précises <span>facultatif</span></summary>
                  <div className="coordinate-grid">
                    <label>Latitude<input type="number" step="0.000001" value={draft.latitude} onChange={(event) => { update("latitude", event.target.value); update("locationConfirmed", true); }} /></label>
                    <label>Longitude<input type="number" step="0.000001" value={draft.longitude} onChange={(event) => { update("longitude", event.target.value); update("locationConfirmed", true); }} /></label>
                  </div>
                </details>
                <label className="field-wide">Précision proposée<select value={draft.displayPrecision} onChange={(event) => update("displayPrecision", event.target.value as Draft["displayPrecision"])}><option value="exact">Position exacte</option><option value="approximate">Zone approximative</option></select></label>
              </div>
              <label className="check-row"><input type="checkbox" checked={draft.accessWithoutTrespass} onChange={(event) => update("accessWithoutTrespass", event.target.checked)} /><span>Je confirme que l&apos;accès ne nécessite ni intrusion, ni arrêt dangereux.</span></label>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <fieldset>
              <legend>Quel décor avez-vous trouvé ?</legend>
              <p className="fieldset-intro">Aidez un motard à comprendre le rendu possible avant de se déplacer.</p>
              <div className="form-grid">
                <label className="field-wide">Nom proposé<input value={draft.name} maxLength={120} onChange={(event) => update("name", event.target.value)} placeholder="Ex. Belvédère des coteaux" /></label>
                <div className="field-wide"><span className="field-label">Types de décor · 3 maximum</span><div className="choice-grid">{spotCategories.map((category) => <button key={category} type="button" className={draft.categories.includes(category) ? "selected" : ""} onClick={() => toggleCategory(category)} aria-pressed={draft.categories.includes(category)}>{categoryLabels[category]}</button>)}</div></div>
                <label className="field-wide">Ambiance et rendu<textarea rows={4} maxLength={500} value={draft.shortDescription} onChange={(event) => update("shortDescription", event.target.value)} placeholder="Décrivez les couleurs, les lignes et l'espace disponible…" /></label>
                <div className="field-wide"><span className="field-label">Meilleurs moments</span><div className="choice-grid compact">{([['morning','Matin'],['day','Journée'],['golden_hour','Golden hour'],['sunset','Coucher de soleil'],['night','Nuit']] as const).map(([value,label]) => <button key={value} type="button" className={draft.bestTimes.includes(value) ? "selected" : ""} onClick={() => update("bestTimes", draft.bestTimes.includes(value) ? draft.bestTimes.filter((item) => item !== value) : draft.bestTimes.length < 3 ? [...draft.bestTimes, value] : draft.bestTimes)} aria-pressed={draft.bestTimes.includes(value)}>{label}</button>)}</div></div>
                <label className="field-wide">Particularités visuelles <span>facultatif</span><textarea rows={3} maxLength={500} value={draft.visualFeatures} onChange={(event) => update("visualFeatures", event.target.value)} placeholder="Orientation de la lumière, cadrage conseillé…" /></label>
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <fieldset>
              <legend><ShieldCheck /> Accès et sécurité</legend>
              <p className="fieldset-intro">Soyez concret : ces informations seront affichées avant le bouton d&apos;itinéraire.</p>
              <div className="form-grid">
                <label>Niveau d&apos;accès<select value={draft.accessLevel} onChange={(event) => update("accessLevel", event.target.value as Draft["accessLevel"])}><option value="easy">Facile</option><option value="intermediate">Intermédiaire</option><option value="difficult">Difficile</option></select></label>
                <label>Type de sol<select value={draft.surfaceType} onChange={(event) => update("surfaceType", event.target.value as Draft["surfaceType"])}><option value="asphalt">Bitume</option><option value="gravel">Gravier</option><option value="earth">Terre</option><option value="mixed">Mixte</option></select></label>
                <label>Fréquentation<select value={draft.attendance} onChange={(event) => update("attendance", event.target.value as Draft["attendance"])}><option value="quiet">Calme</option><option value="variable">Variable</option><option value="busy">Fréquenté</option></select></label>
                <label>Statut du lieu<select value={draft.locationStatus} onChange={(event) => update("locationStatus", event.target.value as Draft["locationStatus"])}><option value="public">Public</option><option value="private_with_permission">Privé avec autorisation</option><option value="to_confirm">À confirmer</option><option value="sensitive">Sensible</option></select></label>
                <label className="field-wide">Stationnement<textarea rows={3} value={draft.parking} onChange={(event) => update("parking", event.target.value)} /></label>
                <label className="field-wide">Approche à pied<textarea rows={3} value={draft.walkingApproach} onChange={(event) => update("walkingApproach", event.target.value)} /></label>
                <label className="field-wide">Circulation et nuisances<textarea rows={3} value={draft.traffic} onChange={(event) => update("traffic", event.target.value)} /></label>
                <label className="field-wide">Risques et restrictions<textarea rows={4} maxLength={2000} value={draft.risks} onChange={(event) => update("risks", event.target.value)} placeholder="Une consigne par ligne si possible." /></label>
              </div>
            </fieldset>
          ) : null}

          {step === 3 ? (
            <fieldset>
              <legend><Camera /> Ajoutez vos photos</legend>
              <p className="fieldset-intro">2 à 6 images JPEG, PNG ou WebP, 15 Mo maximum chacune et au moins 1000 × 600 pixels. Les métadonnées sont retirées des versions publiables.</p>
              <label className="upload-zone"><Camera /><strong>{checkingPhotos ? "Vérification des images…" : photos.length ? "Ajouter d’autres photos" : "Choisir des photos"}</strong><span>{photos.length}/6 sélectionnées · vous pouvez les choisir ensemble ou une par une.</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={checkingPhotos} onChange={(event) => { void addPhotos(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
              {photoSelectionMessage ? <p className={`photo-selection-message${photoSelectionError ? " is-error" : ""}`} role={photoSelectionError ? "alert" : "status"}>{photoSelectionMessage}</p> : null}
              <div className="photo-file-list">{photos.map((photo, index) => <article key={`${photo.name}-${photo.size}-${photo.lastModified}`}><div><strong>{index + 1}. {photo.name}</strong><span>{(photo.size / 1024 / 1024).toFixed(1)} Mo</span></div><div><button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={`Monter ${photo.name}`}><ArrowUp size={16} /></button><button type="button" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label={`Descendre ${photo.name}`}><ArrowDown size={16} /></button><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Supprimer ${photo.name}`}><Trash2 size={16} /></button></div></article>)}</div>
              <div className="form-grid"><label className="field-wide">Crédit photo <span>facultatif</span><input value={draft.photoCredit} maxLength={120} onChange={(event) => update("photoCredit", event.target.value)} /></label></div>
              <label className="check-row"><input type="checkbox" checked={draft.rightsDeclared} onChange={(event) => update("rightsDeclared", event.target.checked)} /><span>Je possède les droits nécessaires pour autoriser la diffusion de ces photos.</span></label>
              <label className="check-row"><input type="checkbox" checked={draft.peopleConfirmed} onChange={(event) => update("peopleConfirmed", event.target.checked)} /><span>Aucune personne reconnaissable n&apos;apparaît sans accord ; les plaques visibles seront contrôlées avant publication.</span></label>
            </fieldset>
          ) : null}

          {step === 4 ? (
            <fieldset>
              <legend>Contact et récapitulatif</legend>
              <p className="fieldset-intro">Nous vous envoyons un lien temporaire. La proposition rejoindra la modération seulement après votre confirmation.</p>
              <div className="recap-list">{stepNames.slice(0, 4).map((name, index) => <button type="button" key={name} onClick={() => { setErrors([]); setStep(index); }}><span><small>{name}</small><strong>{summary[index]}</strong></span><ArrowRight size={17} /></button>)}</div>
              <div className="form-grid">
                <label>Adresse e-mail<input type="email" autoComplete="email" value={draft.email} onChange={(event) => update("email", event.target.value)} required /></label>
                <label>Pseudonyme public <span>facultatif</span><input value={draft.pseudonym} maxLength={80} onChange={(event) => update("pseudonym", event.target.value)} /></label>
              </div>
              <div className="consent-list">
                <label className="check-row"><input type="checkbox" checked={draft.charterAccepted} onChange={(event) => update("charterAccepted", event.target.checked)} /><span>J&apos;accepte la <a href="/charte" target="_blank">charte de contribution</a>.</span></label>
                <label className="check-row"><input type="checkbox" checked={draft.termsAccepted} onChange={(event) => update("termsAccepted", event.target.checked)} /><span>J&apos;autorise Spotride à examiner, adapter et publier cette contribution.</span></label>
                <label className="check-row"><input type="checkbox" checked={draft.privacyAccepted} onChange={(event) => update("privacyAccepted", event.target.checked)} /><span>J&apos;ai compris que mon e-mail sert uniquement au suivi et à la modération.</span></label>
              </div>
              <label className="honeypot" aria-hidden="true">Site web<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            </fieldset>
          ) : null}

          {errors.length ? <div className="wizard-errors" role="alert"><strong>Vérifiez cette étape :</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
          <div className="wizard-actions">
            {step > 0 ? <button className="button button-secondary" type="button" onClick={() => { setErrors([]); setStep((current) => current - 1); }}><ArrowLeft size={17} /> Précédent</button> : <span />}
            {step < 4 ? <button className="button" type="button" onClick={continueToNextStep}>Continuer <ArrowRight size={17} /></button> : <button className="button" type="button" disabled={submitting} onClick={submitProposal}>{submitting ? <><LoaderCircle className="spin" size={17} /> {submitStage || "Envoi sécurisé…"}</> : "Envoyer et confirmer mon e-mail"}</button>}
          </div>
        </div>

        <aside className="draft-card">
          <span>Brouillon enregistré</span><strong>{summary[step]}</strong>
          <p>Les photos restent uniquement dans cette page jusqu&apos;à l&apos;envoi. Si vous la fermez, vous devrez les sélectionner à nouveau.</p>
        </aside>
      </div>
    </section>
  );
}
