import type { CmsFieldSchema } from '../../types.js';
import { isObject } from '../../internal/typeGuards.js';

/**
 * Narrow an unknown schema object into CmsFieldSchema[]. Fields missing
 * required string members are silently skipped so a single malformed
 * entry doesn't take down the whole schema read.
 *
 * @internal
 */
export function extractSchemaFields(schema: unknown): CmsFieldSchema[] {
  if (!isObject(schema)) return [];
  const fields = schema.fields;
  if (!Array.isArray(fields)) return [];
  const out: CmsFieldSchema[] = [];
  for (const raw of fields) {
    if (!isObject(raw)) continue;
    if (
      typeof raw.id !== 'string' ||
      typeof raw.key !== 'string' ||
      typeof raw.name !== 'string' ||
      typeof raw.type !== 'string'
    ) {
      continue;
    }
    out.push({
      id: raw.id,
      key: raw.key,
      name: raw.name,
      type: raw.type,
      required: raw.required === true,
      multiple: raw.multiple === true,
    });
  }
  return out;
}

/**
 * Merge optional metadata from a JSON Schema object into the given
 * fields. Mutates `fields` in place; only fields whose key matches a
 * property in the schema are touched. Unknown-shaped schemas are
 * ignored silently.
 *
 * @internal
 */
export function mergeJsonSchemaIntoFields(
  schema: Readonly<Record<string, unknown>>,
  fields: CmsFieldSchema[],
): void {
  const properties = schema.properties;
  if (!isObject(properties)) return;
  for (const field of fields) {
    const prop = properties[field.key];
    if (!isObject(prop)) continue;
    applyJsonSchemaExtensions(field, prop);
  }
}

/** Copy description / x-options / x-geoSupportedType(s) from a JSON
 *  Schema property node onto the corresponding CmsFieldSchema. */
function applyJsonSchemaExtensions(
  field: CmsFieldSchema,
  prop: Record<string, unknown>,
): void {
  const description = prop.description;
  if (typeof description === 'string' && description.length > 0) {
    field.description = description;
  }
  // `x-options` appears on select / tag fields as string[].
  const options = prop['x-options'];
  if (Array.isArray(options)) {
    const strs = options.filter((v): v is string => typeof v === 'string');
    if (strs.length > 0) field.options = strs;
  }
  // Geometry fields expose either `x-geoSupportedTypes` (plural array) or
  // `x-geoSupportedType` (singular string) depending on the CMS version.
  const plural = prop['x-geoSupportedTypes'];
  if (Array.isArray(plural)) {
    const strs = plural.filter((v): v is string => typeof v === 'string');
    if (strs.length > 0) field.geoSupportedTypes = strs;
  } else {
    const singular = prop['x-geoSupportedType'];
    if (typeof singular === 'string' && singular.length > 0) {
      field.geoSupportedTypes = [singular];
    }
  }
}
