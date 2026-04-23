import type { CmsItem, CmsField, ClientConfig, CmsPayload, ListOpts } from '../types.js';
import { flattenFields, toCmsFields } from '../mappers.js';
import { applyListOps } from '../filter.js';
import { extractItemCoords, extractItemField } from '../internal/itemShape.js';
import { ReearthApiError } from '../errors.js';
import { isObject } from '../internal/typeGuards.js';
import {
  makeIntegrationClient,
  sendIntegrationPOST,
  wrapIntegrationError,
} from './internal/shared.js';

/**
 * List items for a model via the Integration API (getAllItems).
 *
 * Returns draft and published items together. Items are flattened to the
 * same shape the Public API returns so the shared client-side filter /
 * sort / slice pipeline can run.
 *
 * @internal
 */
export async function listAllItemsIntegration<T>(
  config: ClientConfig,
  model: string,
  opts?: ListOpts,
): Promise<T[]> {
  const cms = makeIntegrationClient(config);
  try {
    const response = await cms.getAllItems({ model, ref: 'latest' });
    const flat = response.results.map((item) => flattenFields<T>(normalizeItem(item)));
    return applyListOps<T>(flat, opts, extractItemCoords, extractItemField);
  } catch (cause) {
    throw wrapIntegrationError('listAllItemsIntegration failed', cause);
  }
}

/**
 * Create a new item via the Integration API.
 *
 * The item lands as a draft and therefore is not visible via the Public
 * API until it is published. Unknown select/tag option strings cause the
 * CMS to return 400, which surfaces here as ReearthApiError with
 * status = 400.
 *
 * @internal
 */
export async function createItemIntegration(
  config: ClientConfig,
  model: string,
  payload: CmsPayload,
): Promise<CmsItem> {
  const cms = makeIntegrationClient(config);
  try {
    const item = await cms.createItem({
      model,
      fields: toCmsFields(payload),
    });
    return normalizeItem(item);
  } catch (cause) {
    throw wrapIntegrationError('createItemIntegration failed', cause);
  }
}

/**
 * Update an existing item via the Integration API. The publish state is
 * preserved (draft stays draft, published stays published).
 *
 * @internal
 */
export async function updateItemIntegration(
  config: ClientConfig,
  itemId: string,
  payload: CmsPayload,
): Promise<CmsItem> {
  const cms = makeIntegrationClient(config);
  try {
    const item = await cms.updateItem({
      itemId,
      fields: toCmsFields(payload),
    });
    return normalizeItem(item);
  } catch (cause) {
    throw wrapIntegrationError('updateItemIntegration failed', cause);
  }
}

/**
 * Delete an item via the Integration API.
 *
 * @internal
 */
export async function deleteItemIntegration(
  config: ClientConfig,
  itemId: string,
): Promise<void> {
  const cms = makeIntegrationClient(config);
  try {
    await cms.deleteItem({ itemId });
  } catch (cause) {
    throw wrapIntegrationError('deleteItemIntegration failed', cause);
  }
}

/**
 * Publish a draft item so it becomes visible via the Public API. Posts
 * an empty body to the dedicated publish endpoint (the SDK does not
 * expose a method for it).
 *
 * @internal
 */
export async function publishItemIntegration(
  config: ClientConfig,
  model: string,
  itemId: string,
): Promise<void> {
  await sendIntegrationPOST(
    config,
    `/models/${encodeURIComponent(model)}/items/${encodeURIComponent(itemId)}/publish`,
  );
}

/**
 * Narrow an SDK-returned item into a CmsItem. Throws when id or fields
 * are missing; nested metadataFields / referencedItems are normalised
 * recursively when present.
 *
 * @internal — exported for tests only.
 */
export function normalizeItem(raw: unknown): CmsItem {
  if (!isObject(raw)) {
    throw new ReearthApiError('Integration API item response is not an object.');
  }
  if (typeof raw.id !== 'string') {
    throw new ReearthApiError('Integration API item is missing "id".');
  }
  if (!Array.isArray(raw.fields)) {
    throw new ReearthApiError(`Integration API item "${raw.id}" is missing "fields".`);
  }
  const item: CmsItem = {
    id: raw.id,
    fields: raw.fields.map((f) => normalizeField(f)),
  };
  if (typeof raw.createdAt === 'string') item.createdAt = raw.createdAt;
  if (typeof raw.updatedAt === 'string') item.updatedAt = raw.updatedAt;
  if (Array.isArray(raw.metadataFields)) {
    item.metadataFields = raw.metadataFields.map((f) => normalizeField(f));
  }
  if (Array.isArray(raw.referencedItems)) {
    item.referencedItems = raw.referencedItems.map((r) => normalizeItem(r));
  }
  return item;
}

/**
 * Narrow an SDK-returned field entry into a CmsField. The type string
 * is passed through as-is so downstream sees the raw CMS type, even
 * when it post-dates the CmsFieldType enum.
 *
 * @internal — exported for tests only.
 */
export function normalizeField(raw: unknown): CmsField {
  if (!isObject(raw)) {
    throw new ReearthApiError('Integration API field entry is not an object.');
  }
  if (typeof raw.key !== 'string' || typeof raw.type !== 'string') {
    throw new ReearthApiError('Integration API field entry is missing "key" or "type".');
  }
  return { key: raw.key, type: raw.type, value: raw.value };
}
