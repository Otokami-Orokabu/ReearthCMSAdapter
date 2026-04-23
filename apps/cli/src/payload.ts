import { readFileSync } from 'node:fs';
import { assertCmsPayload, type CmsPayload } from '@hw/reearth-api-server';

/**
 * CLI options shared by the create / update subcommands.
 *   --data '<json>'   inline JSON object
 *   --file <path>     path to a JSON file
 *   --title '<str>'   shortcut for { title: { type: 'text', value: str } }
 */
export interface PayloadOptions {
  data?: string;
  file?: string;
  title?: string;
}

/**
 * Parse payload options into a CmsPayload. The shape check itself is
 * delegated to assertCmsPayload.
 *
 * @throws Error when none or more than one source is provided.
 * @throws TypeError (from assertCmsPayload) when the JSON shape is
 *   invalid.
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
  assertCmsPayload(json);
  return json;
}
