/**
 * Coordinate / field extractors for the flat item shape produced by
 * flattenFields. Used by applyListOps to filter and sort.
 *
 * @internal
 */

import { isObject } from './typeGuards.js';

/**
 * Extract [lng, lat] from an item's location field (expects GeoJSON
 * Point). Returns null for items without a usable Point location so
 * callers can skip them.
 */
export function extractItemCoords<T>(item: T): readonly [number, number] | null {
  if (!isObject(item)) return null;
  const loc = item.location;
  if (!isObject(loc)) return null;
  if (loc.type !== 'Point') return null;
  const coords = loc.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

/** Read a top-level field from an item. Returns undefined when the item
 *  is not an object or the field is missing. */
export function extractItemField<T>(item: T, field: string): unknown {
  if (!isObject(item)) return undefined;
  return item[field];
}
