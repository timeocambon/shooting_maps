"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

type SpotGalleryProps = {
  photoUrls: string[];
  spotName: string;
};

const MAX_TILES = 5;

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
  const shownTiles = photoUrls.slice(0, MAX_TILES);
  const hiddenCount = count - shownTiles.length;

  return (
    <>
      <section
        className={`detail-gallery${count === 1 ? " single" : ""}`}
        data-count={shownTiles.length}
        aria-label={`Galerie photo de ${spotName} (${count} photo${count > 1 ? "s" : ""})`}
      >
        {shownTiles.map((url, index) => {
          const isLastTile = index === shownTiles.length - 1;
          return (
            <button
              key={url}
              type="button"
              className="gallery-tile"
              onClick={() => setOpenIndex(index)}
            >
              <Image
                unoptimized
                width={1600}
                height={1200}
                sizes={index === 0 ? "(max-width: 1180px) 100vw, 780px" : "(max-width: 620px) 100vw, 390px"}
                src={url}
                alt={`Vue ${index + 1} du spot ${spotName}`}
                priority={index === 0}
              />
              {isLastTile && hiddenCount > 0 ? (
                <span className="gallery-more">+{hiddenCount}</span>
              ) : (
                <span className="gallery-expand" aria-hidden="true">
                  <Expand size={16} />
                </span>
              )}
            </button>
          );
        })}
      </section>

      {openIndex !== null ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${openIndex + 1} sur ${count} — ${spotName}`}
          onClick={close}
        >
          <div className="lightbox-inner" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="lightbox-close" onClick={close} aria-label="Fermer la photo">
              <X size={20} />
            </button>
            {count > 1 ? (
              <button
                type="button"
                className="lightbox-nav prev"
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
              className="lightbox-image"
            />
            {count > 1 ? (
              <button
                type="button"
                className="lightbox-nav next"
                onClick={showNext}
                aria-label="Photo suivante"
              >
                <ChevronRight size={24} />
              </button>
            ) : null}
            {count > 1 ? (
              <p className="lightbox-count">
                {openIndex + 1} / {count}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
