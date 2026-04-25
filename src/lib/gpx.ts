/**
 * Convert a stored ride route (GeoJSON LineString string) into GPX 1.1 XML.
 *
 * The recorded route is held in `RideTrackingData.routeGeoJson` as a stringified
 * GeoJSON `Feature` (or bare `LineString`). We accept either shape so older
 * tracking records still export.
 */

type GeoJsonCoordinate = [number, number] | [number, number, number];

type GeoJsonLineString = {
  type: "LineString";
  coordinates: GeoJsonCoordinate[];
};

type GeoJsonFeature = {
  type: "Feature";
  geometry?: GeoJsonLineString;
  properties?: Record<string, unknown>;
};

type RideForGpx = {
  rideId: string;
  title: string;
  description?: string | null;
  startTime?: Date | null;
  routeGeoJson: string;
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const parseLineString = (raw: string): GeoJsonLineString | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  // Bare LineString
  if ((parsed as GeoJsonLineString).type === "LineString") {
    return parsed as GeoJsonLineString;
  }

  // Feature wrapping a LineString
  if ((parsed as GeoJsonFeature).type === "Feature") {
    const geom = (parsed as GeoJsonFeature).geometry;
    if (geom?.type === "LineString") return geom;
  }

  // FeatureCollection — take the first LineString geometry
  if ((parsed as { type?: string }).type === "FeatureCollection") {
    const features = (parsed as { features?: GeoJsonFeature[] }).features ?? [];
    for (const feature of features) {
      if (feature.geometry?.type === "LineString") {
        return feature.geometry;
      }
    }
  }

  return null;
};

export function rideToGpx(ride: RideForGpx): string {
  const line = parseLineString(ride.routeGeoJson);
  const points = line?.coordinates ?? [];
  const startIso = (ride.startTime ?? new Date()).toISOString();
  const safeName = escapeXml(ride.title);
  const safeDesc = ride.description ? escapeXml(ride.description) : "";

  const trkpts = points
    .map(([lng, lat, ele]) => {
      const eleTag =
        typeof ele === "number" && Number.isFinite(ele)
          ? `<ele>${ele}</ele>`
          : "";
      // GPX expects lat/lon attributes in that order (not lng/lat).
      return `      <trkpt lat="${lat}" lon="${lng}">${eleTag}</trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Zoomies"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${safeName}</name>
    ${safeDesc ? `<desc>${safeDesc}</desc>` : ""}
    <time>${startIso}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}
