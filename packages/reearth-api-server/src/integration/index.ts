/**
 * Re-export barrel for the `integration/*` resource modules.
 *
 * Consumers (e.g. `src/client.ts`) import from this file; the individual
 * resource files stay internal to the package.
 */
export {
  listModelsIntegration,
  getModelIntegration,
  getJsonSchemaIntegration,
} from './models.js';
export {
  listAllItemsIntegration,
  createItemIntegration,
  updateItemIntegration,
  deleteItemIntegration,
  publishItemIntegration,
} from './items.js';
export {
  getAssetIntegration,
  uploadAssetByURLIntegration,
  uploadAssetFileIntegration,
} from './assets.js';
