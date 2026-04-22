import { readFileSync } from 'node:fs';
import {
  CMS_FIELD_TYPE_VALUES,
  type CmsFieldType,
  type CmsPayload,
} from '@hw/reearth-api-server';

const FIELD_TYPES: ReadonlySet<string> = new Set<string>(CMS_FIELD_TYPE_VALUES);

/**
 * Command-line options shared by `create` / `update`:
 *  - `--data '<json>'`  : inline JSON object
 *  - `--file <path>`    : JSON file path
 *  - `--title '<str>'`  : shortcut for `{title: {type: 'text', value: str}}`
 */
export interface PayloadOptions {
  data?: string;
  file?: string;
  title?: string;
}

/**
 * Parse payload options into a {@link CmsPayload}.
 * Throws a user-facing Error when none or multiple sources are given, or
 * when the parsed JSON does not match the `CmsPayload` shape.
 */
export function parsePayload(opts: PayloadOptions): CmsPayload {
  const sources = [opts.data, opts.file, opts.title].filter((s) => s !== undefined);
  if (sources.length === 0) {
    throw new Error('Provide payload via --data <json>, --file <path>, or --title <text>.');
  }
  if (sources.length > 1) {
    throw new Error('Use only one of --data / --file / --title.');
  }

  if (opts.title !== undefined) {
    return { title: { type: 'text', value: opts.title } };
  }

  const json: unknown =
    opts.file !== undefined
      ? JSON.parse(readFileSync(opts.file, 'utf8'))
      : opts.data !== undefined
        ? JSON.parse(opts.data)
        : {};
  return validatePayload(json);
}

/**
 * Narrow an unknown JSON value into a {@link CmsPayload}.
 * Same semantics as the server-side runtime check but decoupled so the CLI
 * can give precise error messages.
 */
function validatePayload(value: unknown): CmsPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Payload must be a JSON object.');
  }
  const payload: CmsPayload = {};
  for (const [key, rawEntry] of Object.entries(value)) {
    if (typeof rawEntry !== 'object' || rawEntry === null) {
      throw new Error(`Field "${key}" must be an object of shape { type, value }.`);
    }
    if (!('type' in rawEntry) || !('value' in rawEntry)) {
      throw new Error(`Field "${key}" is missing "type" or "value".`);
    }
    const entry = rawEntry as { type: unknown; value: unknown };
    if (typeof entry.type !== 'string' || !FIELD_TYPES.has(entry.type)) {
      throw new Error(`Field "${key}" has unknown type "${String(entry.type)}".`);
    }
    payload[key] = { type: entry.type as CmsFieldType, value: entry.value };
  }
  return payload;
}
