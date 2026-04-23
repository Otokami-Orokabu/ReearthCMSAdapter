import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import {
  createHttpApp,
  DEFAULT_MAX_JSON_BODY_BYTES,
  type HttpAppOptions,
} from '../adapters/http/app.js';
import { DEFAULT_MAX_UPLOAD_BYTES } from '../adapters/http/assets.js';

/**
 * reearth-cms serve [--port N]
 *
 * Start an HTTP server that exposes the Core over REST. Port defaults
 * to the PORT env var or 3000.
 */
export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start HTTP server exposing the CMS ACL (for web / Unity / external clients)')
    .option('-p, --port <n>', 'Listen port', parsePort)
    .action(async (options: { port?: number }) => {
      const port = options.port ?? readEnvPort();
      const client = createClient(loadConfig());
      const appOptions: HttpAppOptions = {};
      const maxUploadBytes = readEnvMaxUploadBytes();
      if (maxUploadBytes !== DEFAULT_MAX_UPLOAD_BYTES) appOptions.maxUploadBytes = maxUploadBytes;
      const maxJsonBodyBytes = readEnvMaxJsonBodyBytes();
      if (maxJsonBodyBytes !== DEFAULT_MAX_JSON_BODY_BYTES) appOptions.maxJsonBodyBytes = maxJsonBodyBytes;
      const app = createHttpApp(client, appOptions);
      app.listen(port, () => {
        process.stdout.write(`[serve] listening on http://localhost:${String(port)}\n`);
        process.stdout.write('[serve] GET  /api/health\n');
        process.stdout.write('[serve] GET  /api/items/:model               (Public, published only)\n');
        process.stdout.write('[serve] GET  /api/items/:model/all           (Integration, drafts + published)\n');
        process.stdout.write('[serve] GET  /api/items/:model/:id\n');
        process.stdout.write('[serve] POST /api/items/:model\n');
        process.stdout.write('[serve] GET  /api/features/:model\n');
        process.stdout.write('[serve] GET  /api/features/:model/bbox\n');
        process.stdout.write('[serve] GET  /api/models\n');
        process.stdout.write('[serve] GET  /api/models/:idOrKey\n');
        process.stdout.write('[serve] GET  /api/models/:idOrKey/schema.json\n');
        process.stdout.write('[serve] GET  /api/assets/:id\n');
        process.stdout.write('[serve] POST /api/assets                     (body: { url })\n');
        process.stdout.write('[serve] POST /api/assets/file                (multipart field: file)\n');
      });
    });
}

function parsePort(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    throw new Error(`--port must be 1-65535, got "${raw}"`);
  }
  return n;
}

function readEnvPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw === '') return 3000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    process.stderr.write(`[serve] ignoring invalid PORT=${raw}, falling back to 3000\n`);
    return 3000;
  }
  return n;
}

function readEnvMaxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_MB;
  if (raw === undefined || raw === '') return DEFAULT_MAX_UPLOAD_BYTES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write(
      `[serve] ignoring invalid MAX_UPLOAD_MB=${raw}, falling back to ${String(DEFAULT_MAX_UPLOAD_BYTES / 1024 / 1024)} MB\n`,
    );
    return DEFAULT_MAX_UPLOAD_BYTES;
  }
  return n * 1024 * 1024;
}

function readEnvMaxJsonBodyBytes(): number {
  const raw = process.env.MAX_JSON_BODY_KB;
  if (raw === undefined || raw === '') return DEFAULT_MAX_JSON_BODY_BYTES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write(
      `[serve] ignoring invalid MAX_JSON_BODY_KB=${raw}, falling back to ${String(DEFAULT_MAX_JSON_BODY_BYTES / 1024)} KB\n`,
    );
    return DEFAULT_MAX_JSON_BODY_BYTES;
  }
  return n * 1024;
}
