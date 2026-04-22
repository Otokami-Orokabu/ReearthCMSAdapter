import { ReearthApiError } from './errors.js';

/**
 * Shared `GET` helper used by `public.ts` and `features.ts` to hit the
 * Re:Earth CMS Public API.
 *
 * - Adds `Authorization: Bearer` when `token` is provided
 * - Always sends `Accept: application/json`
 * - Wraps non-2xx responses in {@link ReearthApiError}
 *
 * @internal — not re-exported from the package `index.ts`.
 */
export async function sendPublicGET(
  url: string,
  token: string | undefined,
): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ReearthApiError(
      `Public API request failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      { status: res.status },
    );
  }
  return res.json();
}
