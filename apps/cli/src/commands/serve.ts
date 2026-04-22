import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { createHttpApp } from '../adapters/http/app.js';

/**
 * `reearth-cms serve [--port N]`
 *
 * Starts the HTTP server (Express) that wraps the same Core used by the
 * CLI and MCP adapters. Intended for web / Unity / any HTTP client.
 *
 * Port defaults to `PORT` env var or 3000 (so the existing Vite proxy
 * continues to work unchanged).
 */
export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start HTTP server exposing the CMS ACL (for web / Unity / external clients)')
    .option('-p, --port <n>', 'Listen port', parsePort)
    .action(async (options: { port?: number }) => {
      const port = options.port ?? readEnvPort();
      const client = createClient(loadConfig());
      const app = createHttpApp(client);
      app.listen(port, () => {
        process.stdout.write(`[serve] listening on http://localhost:${String(port)}\n`);
        process.stdout.write('[serve] GET  /api/health\n');
        process.stdout.write('[serve] GET  /api/items/:model\n');
        process.stdout.write('[serve] GET  /api/items/:model/:id\n');
        process.stdout.write('[serve] POST /api/items/:model\n');
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
