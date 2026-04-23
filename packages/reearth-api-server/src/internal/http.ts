import type { ClientConfig } from '../types.js';
import { ReearthApiError } from '../errors.js';

/**
 * Build the Public API URL base: {baseUrl}/api/p/{workspace}/{project}.
 *
 * Callers append a model-scoped suffix such as /{model},
 * /{model}.geojson, or /{model}/{id}.
 *
 * @internal
 */
export function publicBaseUrl(config: ClientConfig): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  return (
    `${base}/api/p` +
    `/${encodeURIComponent(config.workspace)}` +
    `/${encodeURIComponent(config.project)}`
  );
}

/**
 * Send an unauthenticated GET to the given URL and parse the JSON body.
 *
 * @throws ReearthApiError on non-2xx responses (status is copied onto the
 *   error) and on bodies that fail JSON parsing.
 *
 * @internal
 */
export async function sendPublicGET(url: string): Promise<unknown> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ReearthApiError(
      `Public API request failed: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 200)}` : ''}`,
      { status: res.status },
    );
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ReearthApiError(
      `Public API returned invalid JSON: ${text.slice(0, 200)}`,
      { status: res.status, cause },
    );
  }
}
