import type { CmsField } from './fields.js';

/**
 * A single item (row) as represented by the CMS. Raw DTO; downstream
 * code should use flattenFields to convert to a flat domain shape.
 */
export interface CmsItem {
  /** CMS-assigned item id. */
  id: string;
  /** ISO-8601 timestamp of creation, if the CMS returns it. */
  createdAt?: string;
  /** ISO-8601 timestamp of last update, if the CMS returns it. */
  updatedAt?: string;
  /** Primary content fields. Always present (may be an empty array). */
  fields: CmsField[];
  /** Metadata fields, if defined on the model. */
  metadataFields?: CmsField[];
  /** Items referenced via reference fields, inlined by the CMS if requested. */
  referencedItems?: CmsItem[];
}
