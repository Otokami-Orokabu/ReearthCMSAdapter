import { CMSError } from '@reearth/cms-api';
import type { ClientConfig, CmsAsset } from '../types.js';
import { ReearthApiError } from '../errors.js';
import { assertSafeUploadUrl } from '../validate.js';
import { isObject } from '../internal/typeGuards.js';
import { makeIntegrationClient, wrapIntegrationError } from './internal/shared.js';

/**
 * Get a single asset by id.
 *
 * @returns the asset, or null when the CMS returns 404.
 *
 * @internal
 */
export async function getAssetIntegration(
  config: ClientConfig,
  assetId: string,
): Promise<CmsAsset | null> {
  const cms = makeIntegrationClient(config);
  try {
    const raw = await cms.getAsset({ assetId });
    return normalizeAsset(raw);
  } catch (cause) {
    if (cause instanceof CMSError && cause.status === 404) return null;
    throw wrapIntegrationError('getAssetIntegration failed', cause);
  }
}

/**
 * Ask the CMS to fetch `url` and create an asset record. The returned
 * asset id is what gets put into an asset-typed field value.
 *
 * @throws ReearthApiError with status 400 when the URL fails
 *   assertSafeUploadUrl (SSRF guard).
 *
 * @internal
 */
export async function uploadAssetByURLIntegration(
  config: ClientConfig,
  url: string,
): Promise<CmsAsset> {
  assertSafeUploadUrl(url);
  const cms = makeIntegrationClient(config);
  try {
    const raw = await cms.uploadAsset({ url });
    return normalizeAsset(raw);
  } catch (cause) {
    throw wrapIntegrationError('uploadAssetByURLIntegration failed', cause);
  }
}

/**
 * Upload an asset by sending file bytes directly (multipart). The SDK
 * wraps the bytes into a Blob with the given name and content-type
 * before sending.
 *
 * @internal
 */
export async function uploadAssetFileIntegration(
  config: ClientConfig,
  options: { data: Uint8Array; name: string; contentType?: string },
): Promise<CmsAsset> {
  const cms = makeIntegrationClient(config);
  try {
    // Copy into a fresh ArrayBuffer-backed Uint8Array so Blob's BlobPart
    // type (which rejects SharedArrayBuffer-backed views) accepts it.
    const bytes = new Uint8Array(options.data.byteLength);
    bytes.set(options.data);
    const blob = new Blob([bytes], {
      type: options.contentType ?? 'application/octet-stream',
    });
    const opts: { file: Blob; name: string; contentType?: string } = {
      file: blob,
      name: options.name,
    };
    if (options.contentType !== undefined) opts.contentType = options.contentType;
    const raw = await cms.uploadAssetDirectly(opts);
    return normalizeAsset(raw);
  } catch (cause) {
    throw wrapIntegrationError('uploadAssetFileIntegration failed', cause);
  }
}

/**
 * Narrow the SDK's Asset type into CmsAsset.
 *
 * Required fields (throw on absence): id, url, createdAt, updatedAt.
 * Optional fields copied when present: public (defaults to false),
 * name, contentType, totalSize.
 *
 * @internal — exported for tests only.
 */
export function normalizeAsset(raw: unknown): CmsAsset {
  if (!isObject(raw)) {
    throw new ReearthApiError('uploadAsset: response is not an object');
  }
  if (
    typeof raw.id !== 'string' ||
    typeof raw.url !== 'string' ||
    typeof raw.createdAt !== 'string' ||
    typeof raw.updatedAt !== 'string'
  ) {
    throw new ReearthApiError('uploadAsset: response missing required fields');
  }
  const asset: CmsAsset = {
    id: raw.id,
    url: raw.url,
    public: raw.public === true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
  if (typeof raw.name === 'string' && raw.name.length > 0) asset.name = raw.name;
  if (typeof raw.contentType === 'string' && raw.contentType.length > 0) asset.contentType = raw.contentType;
  if (typeof raw.totalSize === 'number') asset.totalSize = raw.totalSize;
  return asset;
}
