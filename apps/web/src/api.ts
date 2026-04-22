/**
 * HTTP fetch wrappers that call the local Express server's `/api/items/*`
 * routes. All server/CMS coupling is kept server-side; this module just
 * speaks HTTP to our own backend.
 */

export type Item = Record<string, unknown>;

interface ListResponse {
  items: Item[];
}

/**
 * Payload shape accepted by the POST /api/items/:model endpoint.
 *
 * NOTE: this is intentionally **duplicated** from `@hw/reearth-api-server`'s
 * `CmsFieldType` / `CmsPayload` to keep the web side free of backend deps —
 * the HTTP wire format is the contract, not the server's internal types.
 * If the server adds a new field type, sync the `CmsFieldType` union here.
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

/**
 * Low-level wrapper: throws Error on non-2xx, returns parsed JSON otherwise.
 * The generic `T` cast is an HTTP boundary ACL — contained here so that
 * consumers receive typed data without repeating the cast.
 */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  return (await res.json()) as T;
}

/**
 * List items for a model via the backend Read route.
 */
export async function listItems(model: string): Promise<Item[]> {
  const res = await fetchJson<ListResponse>(
    `/api/items/${encodeURIComponent(model)}`,
  );
  return res.items;
}

/**
 * Get a single item by ID. Returns null when the backend responds 404.
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

/**
 * Create an item on a model via the backend Write route.
 */
export async function createItem(model: string, payload: CmsPayload): Promise<Item> {
  return fetchJson<Item>(`/api/items/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
