import type { ClientConfig, ReearthClient, ListOpts, CmsPayload } from './types.js';
import { listItemsPublic, getItemPublic } from './public.js';
import { listFeaturesPublic } from './features.js';
import {
  listModelsIntegration,
  getModelIntegration,
  createItemIntegration,
  updateItemIntegration,
  deleteItemIntegration,
  publishItemIntegration,
} from './integration.js';
import { flattenFields } from './mappers.js';

/**
 * Create a stateful Re:Earth CMS client bound to the given configuration.
 *
 * The returned object implements the Primary Port ({@link ReearthClient}).
 * Configuration is captured in a closure; no global state is touched and
 * `process.env` is not read here.
 *
 * Internally:
 * - Read methods go through the Public API (`public.ts`). Public API already
 *   returns flat items, so the result is passed through untouched.
 * - Write methods go through the Integration API (`integration.ts`), which
 *   returns the raw CMS fields-array shape; {@link flattenFields} converts it
 *   to a flat `T` before returning to callers.
 *
 * @example
 * ```ts
 * import { createClient } from '@hw/reearth-api-server';
 *
 * const client = createClient({
 *   baseUrl: process.env.CMS_BASE_URL!,
 *   workspace: process.env.CMS_WORKSPACE!,
 *   project: process.env.CMS_PROJECT!,
 *   integrationToken: process.env.CMS_INTEGRATION_TOKEN!,
 * });
 *
 * const items = await client.listItems<Post>('posts');
 * const created = await client.createItem<Post>('posts', {
 *   title: { type: 'text', value: 'Hello' },
 * });
 * ```
 */
export function createClient(config: ClientConfig): ReearthClient {
  return {
    async listModels() {
      return listModelsIntegration(config);
    },
    async getModel(modelIdOrKey) {
      return getModelIntegration(config, modelIdOrKey);
    },
    async listItems<T>(model: string, opts?: ListOpts): Promise<T[]> {
      return listItemsPublic<T>(config, model, opts);
    },
    async listFeatures(model, opts) {
      return listFeaturesPublic(config, model, opts);
    },
    async getItem<T>(model: string, id: string): Promise<T | null> {
      return getItemPublic<T>(config, model, id);
    },
    async createItem<T>(model: string, payload: CmsPayload): Promise<T> {
      const item = await createItemIntegration(config, model, payload);
      return flattenFields<T>(item);
    },
    async updateItem<T>(itemId: string, payload: CmsPayload): Promise<T> {
      const item = await updateItemIntegration(config, itemId, payload);
      return flattenFields<T>(item);
    },
    async deleteItem(itemId: string): Promise<void> {
      await deleteItemIntegration(config, itemId);
    },
    async publishItem(model: string, itemId: string): Promise<void> {
      await publishItemIntegration(config, model, itemId);
    },
  };
}
