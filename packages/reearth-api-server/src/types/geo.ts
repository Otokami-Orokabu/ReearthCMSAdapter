/** Bounding box in [minLng, minLat, maxLng, maxLat] order (WGS-84 degrees). */
export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];

/** Minimal GeoJSON Point. */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: readonly [number, number];
}

/** Minimal GeoJSON Feature. Geometry is narrowed to Point because the
 *  CMS emits only Point geometries on the .geojson variant. */
export interface GeoJSONFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string;
  geometry: GeoJSONPoint | null;
  properties: P | null;
}

/** GeoJSON FeatureCollection returned by the .geojson variant. */
export interface GeoJSONFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<P>[];
}
