/**
 * HTTP fetch wrappers for the backend's /api routes. The web side
 * speaks HTTP to the backend only; no backend types are imported.
 */

export type Item = Record<string, unknown>;

interface ListResponse {
  items: Item[];
}

/**
 * CmsFieldType and CmsPayload are duplicated (not imported) to keep the
 * web side free of backend dependencies. The HTTP wire format is the
 * contract; if the backend adds a new field type, sync this union.
 */
export type CmsFieldType =
  | 'text'
  | 'textArea'
  | 'markdown'
  | 'richText'
  | 'integer'
  | 'number'
  | 'bool'
  | 'date'
  | 'url'
  | 'select'
  | 'tag'
  | 'asset'
  | 'reference'
  | 'geometryObject';

export type CmsPayload = Record<string, { type: CmsFieldType; value: unknown }>;

/** Low-level wrapper: throws on non-2xx, returns the parsed JSON body
 *  typed as T. The T cast is the HTTP boundary ACL. */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  return (await res.json()) as T;
}

/**
 * List items for a model. Uses the /all variant so drafts created by
 * the web UI appear without a separate publish step.
 */
export async function listItems(model: string): Promise<Item[]> {
  const res = await fetchJson<ListResponse>(
    `/api/items/${encodeURIComponent(model)}/all`,
  );
  return res.items;
}

/**
 * Get a single item by id.
 *
 * @returns the item, or null when the backend responds 404.
 *
 * Visibility mismatch with listItems: this helper reads the backend's
 * /api/items/:model/:id route, which is backed by the CMS Public API
 * (published only). Drafts returned in listItems will show as null
 * here until they are published.
 */
export async function getItem(model: string, id: string): Promise<Item | null> {
  const res = await fetch(
    `/api/items/${encodeURIComponent(model)}/${encodeURIComponent(id)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return (await res.json()) as Item;
}

/** Create an item on a model via the backend write route. */
export async function createItem(model: string, payload: CmsPayload): Promise<Item> {
  return fetchJson<Item>(`/api/items/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
