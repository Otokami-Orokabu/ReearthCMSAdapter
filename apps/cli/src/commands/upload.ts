import { basename } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import { createClient, type CmsAsset } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * readFileSync with graceful ENOENT / EACCES handling. On failure
 * writes an actionable one-line error to stderr and exits with code 1
 * so the caller never sees an unexpected-error stack dump.
 */
function readFileSyncSafe(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch (cause) {
    const err = cause as NodeJS.ErrnoException;
    const code = err.code;
    let message: string;
    if (code === 'ENOENT') message = `file not found: ${path}`;
    else if (code === 'EACCES') message = `cannot read file (permission denied): ${path}`;
    else message = `cannot read file: ${path}${code !== undefined ? ` (${code})` : ''}`;
    process.stderr.write(`error: ${message}\n`);
    process.exit(1);
  }
}

/**
 * reearth-cms upload (--url <url> | --file <path>) [--name <name>]
 *                    [--content-type <mime>] [--json]
 *
 * Create an asset either by asking the CMS to fetch a public URL, or by
 * sending local file bytes directly via multipart. Default output is
 * "id url"; --json emits the full asset object.
 */
export function registerUploadCommand(program: Command): void {
  program
    .command('upload')
    .description('Create an asset from a URL (--url) or a local file (--file)')
    .option('--url <url>', 'Public URL the CMS will fetch from')
    .option('--file <path>', 'Local file path to upload (multipart)')
    .option('--name <name>', 'Override asset name (default: file basename)')
    .option('--content-type <mime>', 'Override content type (e.g. image/png)')
    .option('--json', 'Output the full asset object as JSON')
    .action(
      async (options: {
        url?: string;
        file?: string;
        name?: string;
        contentType?: string;
        json?: boolean;
      }) => {
        const sources = [options.url, options.file].filter((s) => s !== undefined);
        if (sources.length === 0) {
          process.stderr.write('error: provide --url <url> or --file <path>\n');
          process.exit(1);
        }
        if (sources.length > 1) {
          process.stderr.write('error: use only one of --url / --file\n');
          process.exit(1);
        }

        const client = createClient(loadConfig());
        let asset: CmsAsset;
        if (options.url !== undefined) {
          asset = await client.uploadAssetByURL(options.url);
        } else {
          // options.file is defined
          const path = options.file;
          if (path === undefined) {
            throw new Error('unreachable'); // covered by checks above
          }
          const bytes = readFileSyncSafe(path);
          const name = options.name ?? basename(path);
          const uploadOpts: { data: Uint8Array; name: string; contentType?: string } = {
            data: bytes,
            name,
          };
          if (options.contentType !== undefined) {
            uploadOpts.contentType = options.contentType;
          }
          asset = await client.uploadAssetFile(uploadOpts);
        }

        if (options.json === true) {
          process.stdout.write(`${JSON.stringify(asset, null, 2)}\n`);
          return;
        }
        process.stdout.write(`${asset.id}\t${asset.url}\n`);
      },
    );
}
