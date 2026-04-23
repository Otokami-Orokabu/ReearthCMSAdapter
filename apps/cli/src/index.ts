#!/usr/bin/env node
import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerGetCommand } from './commands/get.js';
import { registerCreateCommand } from './commands/create.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerModelsCommand } from './commands/models.js';
import { registerModelCommand } from './commands/model.js';
import { registerSeedCommand } from './commands/seed.js';
import { registerPublishCommand } from './commands/publish.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerServeCommand } from './commands/serve.js';
import { registerFeaturesCommand } from './commands/features.js';
import { ConfigError } from './config.js';
import { ReearthApiError } from '@hw/reearth-api-server';

/**
 * CLI entry for `reearth-cms`.
 *
 * Acts as the unified gateway that shares one Core ({@link createClient})
 * across multiple adapters (CLI subcommands here, future `mcp` / `serve`
 * subcommands for MCP and HTTP modes).
 *
 * Error handling: user-caused errors ({@link ConfigError},
 * {@link ReearthApiError}) render a one-line message; unexpected errors
 * show the full stack.
 */
tryAutoLoadEnv();

const program = new Command();

program
  .name('reearth-cms')
  .description('Re:Earth CMS integration toolkit — CLI hub for Core access')
  .version('0.0.0');

registerListCommand(program);
registerGetCommand(program);
registerCreateCommand(program);
registerUpdateCommand(program);
registerDeleteCommand(program);
registerModelsCommand(program);
registerModelCommand(program);
registerSeedCommand(program);
registerPublishCommand(program);
registerFeaturesCommand(program);
registerMcpCommand(program);
registerServeCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ConfigError || err instanceof ReearthApiError) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(1);
  }
  process.stderr.write('unexpected error:\n');
  console.error(err);
  process.exit(1);
});

/**
 * Best-effort auto-load of a `.env` file from common locations, so the CLI
 * works without wrapping `node --env-file=...`. Existing shell env is
 * preserved — loading is skipped if a required var is already set.
 */
function tryAutoLoadEnv(): void {
  if (process.env.CMS_BASE_URL !== undefined && process.env.CMS_BASE_URL !== '') return;
  // Ordered by the most common cwd for each invocation style:
  //   - ./.env            : running from project root (most common)
  //   - ../../.env        : running from apps/cli via tsx
  //   - ../../../.env     : running from apps/cli/dist
  const candidates = ['./.env', '../../.env', '../../../.env'];
  for (const p of candidates) {
    try {
      process.loadEnvFile(p);
      return;
    } catch {
      // try next
    }
  }
}
