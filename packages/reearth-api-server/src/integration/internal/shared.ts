import { CMS, CMSError } from '@reearth/cms-api';
import type { ClientConfig } from '../../types.js';
import { ReearthApiError } from '../../errors.js';

/** Sentinel returned by sendIntegrationGET so callers can distinguish a
 *  404 "missing" from a throw. */
export const INTEGRATION_NOT_FOUND = Symbol('INTEGRATION_NOT_FOUND');
export type IntegrationNotFound = typeof INTEGRATION_NOT_FOUND;

/** Build a configured CMS SDK instance. */
export function makeIntegrationClient(config: ClientConfig): CMS {
  return new CMS({
    baseURL: config.baseUrl,
    token: config.integrationToken,
    workspace: config.workspace,
    project: config.project,
  });
}

/**
 * Wrap an arbitrary thrown value as a ReearthApiError, copying the HTTP
 * status from the SDK's CMSError when available.
 */
export function wrapIntegrationError(message: string, cause: unknown): ReearthApiError {
  if (cause instanceof CMSError) {
    return new ReearthApiError(`${message}: ${cause.message}`, {
      cause,
      status: cause.status,
    });
  }
  return new ReearthApiError(message, { cause });
}

/** Build the Integration API URL base: {baseUrl}/api/{workspace}/projects/{project}. */
function integrationBaseUrl(config: ClientConfig): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  return `${base}/api/${config.workspace}/projects/${config.project}`;
}

/** Bearer auth + JSON accept headers for Integration API requests. */
function integrationHeaders(config: ClientConfig): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${config.integrationToken}`,
  };
}

/** Throw a ReearthApiError from a non-2xx Response, including up to 200
 *  chars of the body for diagnostics. */
async function throwFromErrorResponse(res: Response, context: string): Promise<never> {
  const body = await res.text().catch(() => '');
  throw new ReearthApiError(
    `${context}: ${res.status} ${res.statusText}${body ? ` - ${body.slice(0, 200)}` : ''}`,
    { status: res.status },
  );
}

/**
 * Raw GET against an Integration API path not covered by the SDK.
 *
 * @returns parsed JSON, or INTEGRATION_NOT_FOUND for 404.
 * @throws ReearthApiError for non-404 non-2xx responses (status is copied
 *   onto the error) and for bodies that fail JSON parsing.
 */
export async function sendIntegrationGET(
  config: ClientConfig,
  pathSuffix: string,
): Promise<unknown | IntegrationNotFound> {
  const res = await fetch(`${integrationBaseUrl(config)}${pathSuffix}`, {
    method: 'GET',
    headers: integrationHeaders(config),
  });
  if (res.status === 404) return INTEGRATION_NOT_FOUND;
  if (!res.ok) await throwFromErrorResponse(res, 'Integration API request failed');
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ReearthApiError(
      `Integration API returned invalid JSON: ${text.slice(0, 200)}`,
      { status: res.status, cause },
    );
  }
}

/**
 * Raw POST against an Integration API path not covered by the SDK. Sends
 * no body unless `body` is provided.
 *
 * @returns the parsed JSON body, or null when the response body is empty.
 * @throws ReearthApiError for non-2xx responses (status is copied onto
 *   the error) and for bodies that fail JSON parsing.
 */
export async function sendIntegrationPOST(
  config: ClientConfig,
  pathSuffix: string,
  body?: unknown,
): Promise<unknown | null> {
  const headers = integrationHeaders(config);
  const init: RequestInit = { method: 'POST', headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${integrationBaseUrl(config)}${pathSuffix}`, init);
  if (!res.ok) await throwFromErrorResponse(res, 'Integration API request failed');
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new ReearthApiError(
      `Integration API returned invalid JSON: ${text.slice(0, 200)}`,
      { status: res.status, cause },
    );
  }
}
