import type { Bbox, SortSpec } from './types.js';

/**
 * Filter items by a geographic bounding box, using a caller-supplied
 * coordinate extractor. Items whose extractor returns `null` are excluded
 * (e.g. no Point location, or non-Point geometry).
 *
 * @param items - Input array (not mutated).
 * @param bbox - `[minLng, minLat, maxLng, maxLat]`.
 * @param getCoords - Returns `[lng, lat]` or `null` for a given item.
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
 * Sort items by a caller-supplied value accessor.
 *
 * Comparison rules:
 * - `undefined` / `null` values are pushed to the end (regardless of direction)
 * - numbers: numeric compare
 * - otherwise: `String(v).localeCompare(...)` (ISO dates and plain strings sort correctly)
 *
 * Returns a new array; does not mutate the input.
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

/**
 * Apply `offset` + `limit` to an array. Short-circuits when neither is set.
 */
export function slice<T>(items: readonly T[], opts: { offset?: number; limit?: number }): T[] {
  const offset = opts.offset ?? 0;
  const end = opts.limit !== undefined ? offset + opts.limit : undefined;
  if (offset === 0 && end === undefined) return [...items];
  return items.slice(offset, end);
}
