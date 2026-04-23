import type { Bbox, ListOpts, NearSpec, SortSpec } from './types.js';

/** Earth radius in meters, used by the Haversine distance. */
const EARTH_RADIUS_M = 6_371_000;

/**
 * Filter items by a geographic bounding box. Items whose extractor
 * returns null are excluded. The input array is not mutated.
 *
 * @param bbox [minLng, minLat, maxLng, maxLat]
 * @param getCoords returns [lng, lat] or null for a given item
 */
export function filterByBbox<T>(
  items: readonly T[],
  bbox: Bbox,
  getCoords: (item: T) => readonly [number, number] | null,
): T[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const out: T[] = [];
  for (const item of items) {
    const c = getCoords(item);
    if (c === null) continue;
    const [lng, lat] = c;
    if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
      out.push(item);
    }
  }
  return out;
}

/**
 * Filter items within `near.radius` metres of `[near.lng, near.lat]`
 * using great-circle (Haversine) distance. Items whose extractor returns
 * null are excluded. The input array is not mutated.
 */
export function filterByRadius<T>(
  items: readonly T[],
  near: NearSpec,
  getCoords: (item: T) => readonly [number, number] | null,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    const c = getCoords(item);
    if (c === null) continue;
    if (haversineMeters(near.lng, near.lat, c[0], c[1]) <= near.radius) {
      out.push(item);
    }
  }
  return out;
}

/** Great-circle distance in metres between two WGS-84 points. Exported
 *  for tests. */
export function haversineMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Sort items by a caller-supplied value accessor. Returns a new array;
 * the input is not mutated.
 *
 * Comparison rules: undefined / null values are pushed to the end,
 * numbers compare numerically, and everything else compares by
 * String(v).localeCompare(...) so ISO dates and plain strings sort
 * correctly.
 */
export function sortBy<T>(
  items: readonly T[],
  spec: SortSpec,
  getValue: (item: T, field: string) => unknown,
): T[] {
  const mul = spec.order === 'desc' ? -1 : 1;
  const arr = [...items];
  arr.sort((a, b) => {
    const va = getValue(a, spec.field);
    const vb = getValue(b, spec.field);
    if (va === vb) return 0;
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
  return arr;
}

/** Apply offset + limit to an array. Short-circuits when neither is set. */
export function slice<T>(items: readonly T[], opts: { offset?: number; limit?: number }): T[] {
  const offset = opts.offset ?? 0;
  const end = opts.limit !== undefined ? offset + opts.limit : undefined;
  if (offset === 0 && end === undefined) return [...items];
  return items.slice(offset, end);
}

/**
 * Apply all client-side list operations in the canonical order:
 * near, then bbox, then sort, then offset/limit. Callers supply the
 * shape-specific extractors so the same function serves both flat items
 * and GeoJSON features.
 */
export function applyListOps<T>(
  items: readonly T[],
  opts: ListOpts | undefined,
  getCoords: (item: T) => readonly [number, number] | null,
  getField: (item: T, field: string) => unknown,
): T[] {
  if (opts === undefined) return [...items];
  let out: readonly T[] = items;
  if (opts.near !== undefined) out = filterByRadius(out, opts.near, getCoords);
  if (opts.bbox !== undefined) out = filterByBbox(out, opts.bbox, getCoords);
  if (opts.sort !== undefined) out = sortBy(out, opts.sort, getField);
  return slice(out, {
    ...(opts.offset !== undefined ? { offset: opts.offset } : {}),
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
  });
}
