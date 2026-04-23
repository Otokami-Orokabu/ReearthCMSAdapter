/**
 * CMS field-level types: the type enum, a single field, the input shape
 * used by create/update (CmsPayload), and the schema shape returned by
 * CmsModelDetail.
 */

/**
 * Runtime list of all CmsFieldType values. Single source of truth for
 * runtime validation (assertCmsPayload). Add new types here; the
 * CmsFieldType union derives from this tuple.
 */
export const CMS_FIELD_TYPE_VALUES = [
  'text',
  'textArea',
  'markdown',
  'richText',
  'integer',
  'number',
  'bool',
  'date',
  'url',
  'select',
  'tag',
  'asset',
  'reference',
  'geometryObject',
] as const satisfies readonly string[];

export type CmsFieldType = (typeof CMS_FIELD_TYPE_VALUES)[number];

/**
 * A single field on an item. Items hold an ordered array of these; within
 * one item the same key is never repeated.
 *
 * `type` is widened to `CmsFieldType | (string & {})` on the read side so
 * the CMS may emit strings that post-date the enum (for example
 * `geometryEditor`, `checkbox`) without being dropped. The write side
 * (CmsPayload) stays strict.
 */
export interface CmsField {
  /** Stable key defined in the CMS schema (e.g. "title", "location"). */
  key: string;
  /** Field type; drives serialisation and validation on the CMS side. */
  type: CmsFieldType | (string & {});
  /** Raw value. Shape depends on `type`. */
  value: unknown;
}

/**
 * Ergonomic input shape for create/update. Each field carries an
 * explicit `type` because the CMS needs one on the wire and guessing
 * from the JS value is ambiguous (a JS number could be integer, number,
 * or select depending on the model).
 *
 * @example
 * const payload: CmsPayload = {
 *   title: { type: 'text', value: 'Hello' },
 *   location: { type: 'geometryObject', value: makePointGeometry(139, 35) },
 * };
 */
export type CmsPayload = Record<string, { type: CmsFieldType; value: unknown }>;

/**
 * Schema of a single field on a CMS model. Returned as part of
 * CmsModelDetail.
 *
 * `type` is a loose string because the CMS may emit types beyond the
 * CmsFieldType enum. `description`, `options`, and `geoSupportedTypes`
 * are populated only when the model schema was fetched via the rich
 * schema.json variant.
 */
export interface CmsFieldSchema {
  /** Field UUID. */
  id: string;
  /** Stable key used when addressing this field in payloads. */
  key: string;
  /** Display name shown in the CMS UI. */
  name: string;
  /** Field type as a string; often matches CmsFieldType. */
  type: string;
  /** Whether the CMS requires this field on create/update. */
  required: boolean;
  /** Whether the field accepts multiple values (array). */
  multiple: boolean;
  /** Field description authored in the CMS UI. */
  description?: string;
  /** Allowed option strings for select / tag fields. Writes with a value
   *  outside this list are rejected with HTTP 400. */
  options?: readonly string[];
  /** Allowed geometry types for geometryObject / geometryEditor fields
   *  (e.g. ["POINT"], ["LINESTRING"]). */
  geoSupportedTypes?: readonly string[];
}
