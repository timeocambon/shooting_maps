"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

type SpotGalleryProps = {
  photoUrls: string[];
  spotName: string;
};

export function SpotGallery({ photoUrls, spotName }: SpotGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const showPrev = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? null : (current - 1 + photoUrls.length) % photoUrls.length,
    );
  }, [photoUrls.length]);

  const showNext = useCallback(() => {
    setOpenIndex((current) =>
      current === null ? null : (current + 1) % photoUrls.length,
    );
  }, [photoUrls.length]);

  useEffect(() => {
    if (openIndex === null) return;

    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openIndex, close, showPrev, showNext]);

  if (!photoUrls.length) return null;

  const count = photoUrls.length;

  return (
    <>
      {/* Bande défilante : chaque photo garde sa largeur naturelle pour une
          hauteur commune, donc un portrait reste un portrait et rien n'est
          recadré arbitrairement. */}
      <section
        className="detail-strip"
        aria-label={`Galerie photo de ${spotName} (${count} photo${count > 1 ? "s" : ""})`}
      >
        <ul>
          {photoUrls.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                className="strip-tile"
                onClick={() => setOpenIndex(index)}
                aria-label={`Agrandir la vue ${index + 1} sur ${count}`}
              >
                <Image
                  width={1200}
                  height={1500}
                  sizes="(max-width: 620px) 80vw, 520px"
                  src={url}
                  alt={`Vue ${index + 1} du spot ${spotName}`}
                  priority={index === 0}
                />
                <span className="strip-expand" aria-hidden="true">
                  <Expand size={16} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {count > 1 ? (
          <p className="strip-hint">{count} photos · faites défiler pour les voir toutes</p>
        ) : null}
      </section>

      {openIndex !== null ? (
        <div
          className="spot-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${openIndex + 1} sur ${count} — ${spotName}`}
          onClick={close}
        >
          <button type="button" className="spot-lightbox-close" onClick={close} aria-label="Fermer la photo">
            <X size={20} />
          </button>
          <div className="spot-lightbox-inner" onClick={(event) => event.stopPropagation()}>
            {count > 1 ? (
              <button
                type="button"
                className="spot-lightbox-nav prev"
                onClick={showPrev}
                aria-label="Photo précédente"
              >
                <ChevronLeft size={24} />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrls[openIndex]}
              alt={`Vue ${openIndex + 1} du spot ${spotName}`}
              className="spot-lightbox-image"
            />
            {count > 1 ? (
              <button
                type="button"
                className="spot-lightbox-nav next"
                onClick={showNext}
                aria-label="Photo suivante"
              >
                <ChevronRight size={24} />
              </button>
            ) : null}
          </div>
          {count > 1 ? (
            <p className="spot-lightbox-count">
              {openIndex + 1} / {count}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
