import type { Bbox } from './geo.js';

/** Sort specification applied client-side after fetch. */
export interface SortSpec {
  /** Field name to sort by. */
  field: string;
  /** Sort direction. Defaults to 'asc'. */
  order?: 'asc' | 'desc';
}

/**
 * Radius-based spatial filter: keep items within `radius` metres of
 * [lng, lat] using great-circle (Haversine) distance. Items without a
 * valid Point location are excluded.
 */
export interface NearSpec {
  /** Centre longitude (WGS-84, -180 to 180). */
  lng: number;
  /** Centre latitude (WGS-84, -90 to 90). */
  lat: number;
  /** Radius in metres. */
  radius: number;
}

/**
 * Options for list operations. All filtering, sorting, and slicing is
 * performed client-side; execution order is near, then bbox, then sort,
 * then offset, then limit.
 */
export interface ListOpts {
  /** Maximum number of items to return after filtering and sorting. */
  limit?: number;
  /** Zero-based offset applied after filtering and sorting. */
  offset?: number;
  /** Keep only items whose location is a Point inside the bbox. */
  bbox?: Bbox;
  /** Keep only items within `near.radius` metres of [near.lng, near.lat]. */
  near?: NearSpec;
  /** Sort result by a field. */
  sort?: SortSpec;
}
