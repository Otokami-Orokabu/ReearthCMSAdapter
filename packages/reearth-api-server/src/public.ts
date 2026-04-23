import type { ClientConfig, ListOpts } from './types.js';
import { ReearthApiError } from './errors.js';
import { publicBaseUrl, sendPublicGET } from './internal/http.js';
import { applyListOps } from './filter.js';
import { extractItemCoords, extractItemField } from './internal/itemShape.js';
import { isObject } from './internal/typeGuards.js';

/**
 * Parsed subset of the Public API list envelope. `page` / `perPage` are
 * dropped because the loop below drives pagination from
 * results.length and totalCount alone.
 */
interface PublicListEnvelope<T> {
  results: T[];
  totalCount: number;
}

/** Build the Public API URL for a model's list endpoint. */
function buildListUrl(config: ClientConfig, model: string): string {
  return `${publicBaseUrl(config)}/${encodeURIComponent(model)}`;
}

/** Build the Public API URL for a single item endpoint. */
function buildItemUrl(config: ClientConfig, model: string, id: string): string {
  return `${buildListUrl(config, model)}/${encodeURIComponent(id)}`;
}

/** Items fetched per page. */
const PAGE_SIZE = 100;

/** Hard cap on the pagination loop to prevent unbounded fetching. */
const MAX_PAGES = 100;

/**
 * List items for a model via the Public API.
 *
 * Fetches every page before applying client-side filter / sort / slice so
 * that offset is computed over the complete result set.
 *
 * @throws ReearthApiError when the model exceeds MAX_PAGES * PAGE_SIZE
 *   (= 10,000) items; the call refuses to return a truncated list.
 *
 * @internal
 */
export async function listItemsPublic<T>(
  config: ClientConfig,
  model: string,
  opts?: ListOpts,
): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(buildListUrl(config, model));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const json = await sendPublicGET(url.toString());
    const parsed = parseListResponse<T>(json);
    results.push(...parsed.results);

    if (parsed.results.length < PAGE_SIZE) break;
    if (results.length >= parsed.totalCount) break;
    if (page === MAX_PAGES) {
      throw new ReearthApiError(
        `listItemsPublic: model "${model}" exceeds the pagination guard ` +
          `(${String(MAX_PAGES)} pages x ${String(PAGE_SIZE)} items = ${String(MAX_PAGES * PAGE_SIZE)}); ` +
          `refusing to return a truncated result. Narrow the query or raise MAX_PAGES if this is legitimate.`,
      );
    }
  }

  return applyListOps<T>(results, opts, extractItemCoords, extractItemField);
}

/**
 * Get a single item by id via the Public API.
 *
 * @returns the item, or null when the CMS returns 404. Drafts are not
 *   exposed by the Public API and therefore also return null.
 *
 * @internal
 */
export async function getItemPublic<T>(
  config: ClientConfig,
  model: string,
  id: string,
): Promise<T | null> {
  try {
    const json = await sendPublicGET(buildItemUrl(config, model, id));
    return parseItemResponse<T>(json);
  } catch (err) {
    if (err instanceof ReearthApiError && err.status === 404) return null;
    throw err;
  }
}

/** Runtime shape check for a single-item response; field contents stay
 *  caller-owned via the generic T. */
function parseItemResponse<T>(json: unknown): T {
  if (!isObject(json)) {
    throw new ReearthApiError(
      `Unexpected Public API response shape: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json as T;
}

/** Runtime shape check for the list envelope. `totalCount` falls back to
 *  0 so the pagination loop terminates on short pages alone. */
function parseListResponse<T>(json: unknown): PublicListEnvelope<T> {
  if (!isObject(json) || !Array.isArray(json.results)) {
    throw new ReearthApiError(
      `Unexpected Public API response shape: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  const totalCount = typeof json.totalCount === 'number' ? json.totalCount : 0;
  return { results: json.results as T[], totalCount };
}
