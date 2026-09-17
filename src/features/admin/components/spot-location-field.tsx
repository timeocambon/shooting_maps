"use client";

import { useState } from "react";
import { LocationPicker } from "@/features/proposals/components/location-picker";

type SpotLocationFieldProps = {
  latitude: number;
  longitude: number;
  mapStyleUrl: string;
};

/**
 * Les coordonnées restent envoyées par les champs « latitude » et
 * « longitude » du formulaire : la carte ne fait que les piloter, ce qui évite
 * de toucher à l'action serveur existante.
 */
export function SpotLocationField({ latitude, longitude, mapStyleUrl }: SpotLocationFieldProps) {
  const [position, setPosition] = useState({ latitude, longitude });
  const moved =
    Math.abs(position.latitude - latitude) > 0.0000005 ||
    Math.abs(position.longitude - longitude) > 0.0000005;

  return (
    <div className="spot-location-field field-wide">
      <span className="field-label">Position sur la carte</span>
      <LocationPicker
        latitude={position.latitude}
        longitude={position.longitude}
        confirmed={!moved}
        onChange={(nextLatitude, nextLongitude) =>
          setPosition({ latitude: nextLatitude, longitude: nextLongitude })
        }
        styleUrl={mapStyleUrl}
      />
      <div className="spot-location-readout">
        <label>
          Latitude
          <input
            name="latitude"
            type="number"
            step="0.000001"
            value={position.latitude}
            onChange={(event) =>
              setPosition((current) => ({ ...current, latitude: Number(event.target.value) }))
            }
            required
          />
        </label>
        <label>
          Longitude
          <input
            name="longitude"
            type="number"
            step="0.000001"
            value={position.longitude}
            onChange={(event) =>
              setPosition((current) => ({ ...current, longitude: Number(event.target.value) }))
            }
            required
          />
        </label>
        {moved ? (
          <p className="spot-location-warning" role="status">
            Point déplacé. Il ne sera enregistré qu’avec le bouton « Enregistrer la fiche ».
          </p>
        ) : null}
      </div>
    </div>
  );
}
