/**
 * Public entry for @hw/reearth-api-server.
 *
 * Consumers must import from this file only; deep imports into internal
 * modules (./client, ./public, ./integration, ...) are forbidden and
 * enforced by ESLint.
 *
 * @packageDocumentation
 */
export { createClient } from './client.js';
export { ReearthApiError } from './errors.js';
export { flattenFields, toCmsFields, makePointGeometry } from './mappers.js';
export { CMS_FIELD_TYPE_VALUES } from './types.js';
export { assertCmsPayload } from './validate.js';
export type {
  ClientConfig,
  ReearthClient,
  CmsField,
  CmsFieldType,
  CmsFieldSchema,
  CmsItem,
  CmsJsonSchema,
  CmsModel,
  CmsModelDetail,
  CmsAsset,
  CmsPayload,
  ListOpts,
  Bbox,
  SortSpec,
  NearSpec,
  GeoJSONPoint,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from './types.js';
export type { ReearthApiErrorOptions } from './errors.js';
