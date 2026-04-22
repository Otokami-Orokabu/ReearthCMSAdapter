import type { ClientConfig, ListOpts } from './types.js';
import { ReearthApiError } from './errors.js';
import { sendPublicGET } from './_http.js';
import { filterByBbox, sortBy, slice } from './filter.js';

/**
 * Response shape of the Re:Earth CMS Public API list endpoint.
 */
interface PublicListResponse<T> {
  results: T[];
  page: number;
  perPage: number;
  totalCount: number;
}

/**
 * Build the Public API URL for a list endpoint.
 *
 * Re:Earth CMS Public API uses a **3-segment path**:
 *   `/api/p/{workspace}/{project}/{model}`
 *
 * The official SDK (`@reearth/cms-api/public` v0.2.0) only supports the
 * 2-segment legacy format (`/api/p/{project}/{model}`), so we bypass it here
 * and build the URL ourselves.
 *
 * **Visibility note**: Public API only returns **published** items. Items
 * created via the Integration API remain as draft until published through
 * a separate endpoint, so they will not appear here until then.
 */
function buildListUrl(config: ClientConfig, model: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  return (
    `${base}/api/p` +
    `/${encodeURIComponent(config.workspace)}` +
    `/${encodeURIComponent(config.project)}` +
    `/${encodeURIComponent(model)}`
  );
}

/**
 * Build the Public API URL for a single item endpoint.
 *
 * Path: `/api/p/{workspace}/{project}/{model}/{id}`
 */
function buildItemUrl(config: ClientConfig, model: string, id: string): string {
  return `${buildListUrl(config, model)}/${encodeURIComponent(id)}`;
}

/**
 * List items for a model via the Re:Earth CMS **Public API**.
 *
 * Public API returns already-flat items. After fetch we apply client-side
 * filtering (bbox on `item.location`), sorting (`item[field]`), and
 * slicing (`offset` + `limit`) in that order.
 *
 * @internal — called by {@link createClient} only.
 */
export async function listItemsPublic<T>(
  config: ClientConfig,
  model: string,
  opts?: ListOpts,
): Promise<T[]> {
  const url = new URL(buildListUrl(config, model));
  // Hint server-side pagination (may be ignored for small models);
  // the client-side slice below is the actual guarantee.
  if (opts?.limit !== undefined) url.searchParams.set('per_page', String(opts.limit));

  const json = await sendPublicGET(url.toString(), config.publicToken);
  const parsed = parseListResponse<T>(json);

  let items: T[] = parsed.results;
  if (opts?.bbox !== undefined) items = filterByBbox(items, opts.bbox, extractItemCoords);
  if (opts?.sort !== undefined) items = sortBy(items, opts.sort, extractItemField);
  return slice(items, { ...(opts?.offset !== undefined ? { offset: opts.offset } : {}), ...(opts?.limit !== undefined ? { limit: opts.limit } : {}) });
}

/**
 * Get a single item by ID via the Re:Earth CMS **Public API**.
 *
 * @returns The item, or `null` if the CMS returns 404.
 *
 * @internal — called by {@link createClient} only.
 */
export async function getItemPublic<T>(
  config: ClientConfig,
  model: string,
  id: string,
): Promise<T | null> {
  try {
    const json = await sendPublicGET(buildItemUrl(config, model, id), config.publicToken);
    return json as T;
  } catch (err) {
    if (err instanceof ReearthApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Extract `[lng, lat]` from an item's `location` field (expects GeoJSON Point).
 * Returns `null` for items without a usable Point location.
 */
function extractItemCoords<T>(item: T): readonly [number, number] | null {
  if (typeof item !== 'object' || item === null) return null;
  if (!('location' in item)) return null;
  const loc = (item as { location: unknown }).location;
  if (typeof loc !== 'object' || loc === null) return null;
  if (!('type' in loc) || !('coordinates' in loc)) return null;
  if (loc.type !== 'Point') return null;
  const coords = (loc as { coordinates: unknown }).coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = coords[0];
  const lat = coords[1];
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

/**
 * Read a top-level field from an item. Returns `undefined` if the item is
 * not an object or the field is missing.
 */
function extractItemField<T>(item: T, field: string): unknown {
  if (typeof item !== 'object' || item === null) return undefined;
  return (item as Record<string, unknown>)[field];
}

/**
 * Narrow an unknown JSON body to {@link PublicListResponse}. Fails fast if
 * the shape is unexpected — this is the ACL boundary.
 */
function parseListResponse<T>(json: unknown): PublicListResponse<T> {
  if (
    typeof json !== 'object' ||
    json === null ||
    !('results' in json) ||
    !Array.isArray((json as { results: unknown }).results)
  ) {
    throw new ReearthApiError(
      `Unexpected Public API response shape: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json as PublicListResponse<T>;
}
