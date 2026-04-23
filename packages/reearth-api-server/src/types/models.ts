import type { CmsFieldSchema } from './fields.js';

/** Lightweight CMS model shape: id, key, name, and an optional
 *  description. For schema details use CmsModelDetail. */
export interface CmsModel {
  /** Model UUID. */
  id: string;
  /** Human-readable key. */
  key: string;
  /** Display name shown in the CMS UI. */
  name: string;
  /** Description authored in the CMS, if any. */
  description?: string;
}

/** A model together with its field schema. */
export interface CmsModelDetail extends CmsModel {
  /** Key of the field used as the title of items. */
  titleField?: string;
  /** All fields defined on the model schema. */
  fields: CmsFieldSchema[];
}

/** Raw JSON Schema document returned by the schema.json endpoint.
 *  Treated as opaque JSON at this layer. */
export type CmsJsonSchema = Readonly<Record<string, unknown>>;
