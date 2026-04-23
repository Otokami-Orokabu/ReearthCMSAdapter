import type { ClientConfig, ReearthClient, ListOpts, CmsPayload } from './types.js';
import { listItemsPublic, getItemPublic } from './public.js';
import { listFeaturesPublic, getBoundsPublic } from './features.js';
import {
  listModelsIntegration,
  getModelIntegration,
  getJsonSchemaIntegration,
  listAllItemsIntegration,
  createItemIntegration,
  updateItemIntegration,
  deleteItemIntegration,
  publishItemIntegration,
  getAssetIntegration,
  uploadAssetByURLIntegration,
  uploadAssetFileIntegration,
} from './integration/index.js';
import { flattenFields } from './mappers.js';

/**
 * Create a stateful client bound to the given configuration. The returned
 * object is a ReearthClient; configuration is captured in a closure and
 * no global state or process.env is read here.
 *
 * @example
 * const client = createClient({
 *   baseUrl: process.env.CMS_BASE_URL!,
 *   workspace: process.env.CMS_WORKSPACE!,
 *   project: process.env.CMS_PROJECT!,
 *   integrationToken: process.env.CMS_INTEGRATION_TOKEN!,
 * });
 * const items = await client.listItems<Post>('posts');
 */
export function createClient(config: ClientConfig): ReearthClient {
  return {
    async listModels() {
      return listModelsIntegration(config);
    },
    async getModel(modelIdOrKey) {
      return getModelIntegration(config, modelIdOrKey);
    },
    async getJsonSchema(modelIdOrKey) {
      return getJsonSchemaIntegration(config, modelIdOrKey);
    },
    async listItems<T>(model: string, opts?: ListOpts): Promise<T[]> {
      return listItemsPublic<T>(config, model, opts);
    },
    async listAllItems<T>(model: string, opts?: ListOpts): Promise<T[]> {
      return listAllItemsIntegration<T>(config, model, opts);
    },
    async listFeatures(model, opts) {
      return listFeaturesPublic(config, model, opts);
    },
    async getBounds(model) {
      return getBoundsPublic(config, model);
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
    async getAsset(assetId) {
      return getAssetIntegration(config, assetId);
    },
    async uploadAssetByURL(url) {
      return uploadAssetByURLIntegration(config, url);
    },
    async uploadAssetFile(options) {
      return uploadAssetFileIntegration(config, options);
    },
  };
}
