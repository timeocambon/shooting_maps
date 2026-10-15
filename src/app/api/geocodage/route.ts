import { z } from "zod";

const geocodingResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number(), z.number()]),
      }),
      properties: z.object({
        label: z.string(),
        city: z.string().optional(),
        postcode: z.string().optional(),
        score: z.number().optional(),
      }),
    }),
  ),
});

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const address = requestUrl.searchParams.get("adresse")?.trim() ?? "";
  const latitudeParam = requestUrl.searchParams.get("latitude");
  const longitudeParam = requestUrl.searchParams.get("longitude");
  const latitude = Number(latitudeParam);
  const longitude = Number(longitudeParam);
  const isReverseLookup =
    latitudeParam !== null &&
    longitudeParam !== null &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;

  if (!isReverseLookup && (address.length < 5 || address.length > 180)) {
    return Response.json(
      { ok: false, message: "Saisissez une adresse suffisamment précise." },
      { status: 400 },
    );
  }

  const endpoint = new URL(
    isReverseLookup
      ? "https://data.geopf.fr/geocodage/reverse"
      : "https://data.geopf.fr/geocodage/search",
  );
  endpoint.searchParams.set("index", "address");
  endpoint.searchParams.set("limit", isReverseLookup ? "1" : "5");

  if (isReverseLookup) {
    endpoint.searchParams.set("lat", String(latitude));
    endpoint.searchParams.set("lon", String(longitude));
    endpoint.searchParams.set(
      "searchgeom",
      JSON.stringify({
        type: "Circle",
        coordinates: [longitude, latitude],
        radius: 100,
      }),
    );
  } else {
    endpoint.searchParams.set("q", address);
    endpoint.searchParams.set("lat", "43.6045");
    endpoint.searchParams.set("lon", "1.4442");
  }

  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    });

    if (!response.ok) {
      throw new Error(`geocoding_${response.status}`);
    }

    const parsed = geocodingResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("invalid_geocoding_response");

    const results = parsed.data.features.map((feature) => ({
      label: feature.properties.label,
      municipality: feature.properties.city ?? "",
      postalCode: feature.properties.postcode ?? "",
      longitude: feature.geometry.coordinates[0],
      latitude: feature.geometry.coordinates[1],
      score: feature.properties.score ?? 0,
    }));

    return Response.json({ ok: true, results });
  } catch {
    return Response.json(
      {
        ok: false,
        message:
          "La recherche d’adresse est momentanément indisponible. Vous pouvez toujours placer le repère manuellement.",
      },
      { status: 502 },
    );
  }
}
