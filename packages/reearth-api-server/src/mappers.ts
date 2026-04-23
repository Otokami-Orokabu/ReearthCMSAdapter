import type { CmsItem, CmsFieldType, CmsPayload } from './types.js';

/**
 * Write-side field shape returned by toCmsFields. `type` stays strict so
 * the external SDK accepts the array without a cast.
 *
 * @internal
 */
type CmsWriteField = { key: string; type: CmsFieldType; value: unknown };

/**
 * Convert a CmsItem into a flat, domain-shaped object.
 *
 * Spreads id, createdAt, updatedAt (when present) alongside each field's
 * value keyed by the field's key. The caller supplies T as the intended
 * domain shape; the final runtime-to-T cast lives inside this function.
 *
 * @remarks
 * Lossy: metadataFields and referencedItems are dropped. Only top-level
 * fields become properties on the returned object.
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
 * Convert a CmsPayload dict into the CMS fields array wire format.
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
export function toCmsFields(obj: CmsPayload): CmsWriteField[] {
  return Object.entries(obj).map(([key, spec]) => ({
    key,
    type: spec.type,
    value: spec.value,
  }));
}

/**
 * Build a GeoJSON Point geometry suitable for a geometryObject field.
 *
 * Coordinate order is [longitude, latitude] (x, y) per the GeoJSON spec.
 *
 * @param lng longitude in [-180, 180]
 * @param lat latitude in [-90, 90]
 */
export function makePointGeometry(
  lng: number,
  lat: number,
): { type: 'Point'; coordinates: [number, number] } {
  return { type: 'Point', coordinates: [lng, lat] };
}
