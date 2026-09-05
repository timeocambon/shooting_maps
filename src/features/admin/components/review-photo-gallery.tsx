"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, EyeOff, Expand, ImageOff, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

type ReviewPhoto = {
  id: string;
  displayOrder: number;
  credit: string | null;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  signedUrl: string;
  moderationState: "pending" | "approved" | "hidden" | "rejected";
};

type ReviewPhotoGalleryProps = {
  photos: ReviewPhoto[];
  spotName: string;
  /**
   * Action liée à la proposition (proposalId déjà bindé) qui bascule l'état
   * d'une photo. Absente = galerie en lecture seule (proposition déjà
   * décidée, ou composant réutilisé ailleurs sans modération).
   */
  moderateAction?: (formData: FormData) => void | Promise<void>;
};

export function ReviewPhotoGallery({ photos, spotName, moderateAction }: ReviewPhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const selectedPhoto = photos[selectedIndex];

  function selectPrevious() {
    setSelectedIndex((current) => (current - 1 + photos.length) % photos.length);
  }

  function selectNext() {
    setSelectedIndex((current) => (current + 1) % photos.length);
  }

  useEffect(() => {
    if (!expanded) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) => (current - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) => (current + 1) % photos.length);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded, photos.length]);

  if (!selectedPhoto) {
    return <div className="review-gallery-empty"><ImageOff /><strong>Aucune photo exploitable</strong></div>;
  }

  const details = `${selectedPhoto.width ?? "?"} × ${selectedPhoto.height ?? "?"} px · ${
    selectedPhoto.byteSize ? (selectedPhoto.byteSize / 1024 / 1024).toFixed(1) : "?"
  } Mo${selectedPhoto.credit ? ` · Crédit : ${selectedPhoto.credit}` : ""}`;
  const isRejected = selectedPhoto.moderationState === "rejected";

  return (
    <section className="review-gallery" aria-label="Photos privées de la proposition">
      <div className="review-gallery-heading">
        <div>
          <span>Contrôle des images</span>
          <strong>Photo {selectedIndex + 1} sur {photos.length}</strong>
        </div>
        <button type="button" onClick={() => setExpanded(true)} disabled={!selectedPhoto.signedUrl}><Expand size={16} /> Agrandir</button>
      </div>

      {moderateAction ? (
        <div className="review-photo-moderation">
          {isRejected ? <span className="review-photo-flag">Exclue de la publication</span> : null}
          <form action={moderateAction}>
            <input type="hidden" name="photoId" value={selectedPhoto.id} />
            {isRejected ? (
              <button type="submit" name="etat" value="pending">
                <RotateCcw size={14} aria-hidden="true" /> Réintégrer cette photo
              </button>
            ) : (
              <button type="submit" name="etat" value="rejected" className="reject">
                <EyeOff size={14} aria-hidden="true" /> Exclure cette photo
              </button>
            )}
          </form>
        </div>
      ) : null}

      <figure className={`review-gallery-main${isRejected ? " is-rejected" : ""}`}>
        {selectedPhoto.signedUrl ? (
          <Image
            unoptimized
            priority
            src={selectedPhoto.signedUrl}
            width={selectedPhoto.width ?? 1600}
            height={selectedPhoto.height ?? 1000}
            sizes="(max-width: 900px) 100vw, 1180px"
            alt={`Photo ${selectedIndex + 1} proposée pour ${spotName}`}
          />
        ) : <div className="missing-photo"><ImageOff /></div>}
        {photos.length > 1 ? <>
          <button className="review-gallery-arrow previous" type="button" onClick={selectPrevious} aria-label="Photo précédente"><ChevronLeft /></button>
          <button className="review-gallery-arrow next" type="button" onClick={selectNext} aria-label="Photo suivante"><ChevronRight /></button>
        </> : null}
        <figcaption>{details}</figcaption>
      </figure>

      {photos.length > 1 ? (
        <div className="review-gallery-thumbnails" aria-label="Choisir une photo">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              className={[
                index === selectedIndex ? "selected" : "",
                photo.moderationState === "rejected" ? "rejected" : "",
              ].join(" ").trim()}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Afficher la photo ${index + 1}${photo.moderationState === "rejected" ? " (exclue)" : ""}`}
              aria-pressed={index === selectedIndex}
            >
              {photo.signedUrl ? <Image unoptimized src={photo.signedUrl} width={180} height={120} alt="" /> : <ImageOff />}
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className="review-gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Photo ${selectedIndex + 1} en plein écran`}>
          <button className="lightbox-close" type="button" onClick={() => setExpanded(false)} aria-label="Fermer"><X /></button>
          <Image unoptimized src={selectedPhoto.signedUrl} width={selectedPhoto.width ?? 1800} height={selectedPhoto.height ?? 1200} sizes="100vw" alt={`Photo ${selectedIndex + 1} proposée pour ${spotName}`} />
          {photos.length > 1 ? <>
            <button className="lightbox-arrow previous" type="button" onClick={selectPrevious} aria-label="Photo précédente"><ChevronLeft /></button>
            <button className="lightbox-arrow next" type="button" onClick={selectNext} aria-label="Photo suivante"><ChevronRight /></button>
          </> : null}
          <p>Photo {selectedIndex + 1}/{photos.length} · {details}</p>
        </div>
      ) : null}
    </section>
  );
}
