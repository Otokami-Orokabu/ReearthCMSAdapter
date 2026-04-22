import type { CmsItem, CmsField, CmsPayload } from './types.js';

/**
 * Convert a {@link CmsItem} (CMS's `fields: [{key, type, value}]` array) into
 * a flat domain-shaped object.
 *
 * The output spreads `id`, `createdAt`, `updatedAt` (when present) alongside
 * each field's `value` keyed by `key`. Field-level `type` information is
 * dropped; the caller supplies `T` as the intended domain shape.
 *
 * @param item - Raw CMS item (typically returned by Integration API).
 * @returns Flat object typed as `T`.
 *
 * @remarks The final cast to `T` is an unavoidable ACL boundary conversion
 *   (runtime-shaped → user-defined static type). Kept scoped to this function.
 */
export function flattenFields<T>(item: CmsItem): T {
  const result: Record<string, unknown> = { id: item.id };
  if (item.createdAt !== undefined) result.createdAt = item.createdAt;
  if (item.updatedAt !== undefined) result.updatedAt = item.updatedAt;
  for (const field of item.fields) {
    result[field.key] = field.value;
  }
  return result as T;
}

/**
 * Convert a {@link CmsPayload} dict into CMS-compatible `fields` array format.
 *
 * @example
 * toCmsFields({
 *   title: { type: 'text', value: 'Hello' },
 *   location: { type: 'geometryObject', value: makePointGeometry(139, 35) },
 * })
 * // => [
 * //   { key: 'title', type: 'text', value: 'Hello' },
 * //   { key: 'location', type: 'geometryObject', value: {...} }
 * // ]
 */
export function toCmsFields(obj: CmsPayload): CmsField[] {
  return Object.entries(obj).map(([key, spec]) => ({
    key,
    type: spec.type,
    value: spec.value,
  }));
}

/**
 * Build a GeoJSON Point geometry suitable for a `geometryObject` field.
 *
 * GeoJSON spec: coordinate order is `[longitude, latitude]` (x, y).
 * This is the OPPOSITE of many map libraries that use `[lat, lng]`, so be
 * careful when interoperating.
 *
 * @param lng - Longitude (-180 to 180).
 * @param lat - Latitude (-90 to 90).
 */
export function makePointGeometry(
  lng: number,
  lat: number,
): { type: 'Point'; coordinates: [number, number] } {
  return { type: 'Point', coordinates: [lng, lat] };
}
