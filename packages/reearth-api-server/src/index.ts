/**
 * Public entry for `@hw/reearth-api-server`.
 *
 * This package is a thin wrapper (Anti-Corruption Layer) around the official
 * `@reearth/cms-api` SDK. It exposes a Primary Port ({@link ReearthClient})
 * that is stable against CMS-side schema evolution and SDK versioning.
 *
 * **Import policy**: consumers must import from THIS file only. Deep imports
 * into internal modules (`./client`, `./public`, `./integration`, etc.) are
 * forbidden and enforced by ESLint (`no-restricted-imports`).
 *
 * @packageDocumentation
 */
export { createClient } from './client.js';
export { ReearthApiError } from './errors.js';
export { flattenFields, toCmsFields, makePointGeometry } from './mappers.js';
export { CMS_FIELD_TYPE_VALUES } from './types.js';
export type {
  ClientConfig,
  ReearthClient,
  CmsField,
  CmsFieldType,
  CmsFieldSchema,
  CmsItem,
  CmsModel,
  CmsModelDetail,
  CmsPayload,
  ListOpts,
  Bbox,
  SortSpec,
  GeoJSONPoint,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from './types.js';
export type { ReearthApiErrorOptions } from './errors.js';
