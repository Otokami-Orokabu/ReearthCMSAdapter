#!/usr/bin/env node
import { Command } from 'commander';
import { registerListCommand } from './commands/list.js';
import { registerGetCommand } from './commands/get.js';
import { registerCreateCommand } from './commands/create.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerModelsCommand } from './commands/models.js';
import { registerModelCommand } from './commands/model.js';
import { registerSchemaCommand } from './commands/schema.js';
import { registerUploadCommand } from './commands/upload.js';
import { registerAssetCommand } from './commands/asset.js';
import { registerBboxCommand } from './commands/bbox.js';
import { registerSeedCommand } from './commands/seed.js';
import { registerPublishCommand } from './commands/publish.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerServeCommand } from './commands/serve.js';
import { registerFeaturesCommand } from './commands/features.js';
import { ConfigError } from './config.js';
import { ReearthApiError } from '@hw/reearth-api-server';

/**
 * CLI entry for reearth-cms.
 *
 * Registers every subcommand on a single Commander program and hands
 * argv to parseAsync. User-caused errors (ConfigError, ReearthApiError)
 * render a one-line message; unexpected errors print the full stack.
 */
tryAutoLoadEnv();

const program = new Command();

program
  .name('reearth-cms')
  .description('Re:Earth CMS Adapter Hub — CLI / HTTP / MCP entrypoints on top of a shared Core (ACL)')
  .version('0.0.0');

registerListCommand(program);
registerGetCommand(program);
registerCreateCommand(program);
registerUpdateCommand(program);
registerDeleteCommand(program);
registerModelsCommand(program);
registerModelCommand(program);
registerSchemaCommand(program);
registerSeedCommand(program);
registerPublishCommand(program);
registerUploadCommand(program);
registerAssetCommand(program);
registerBboxCommand(program);
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
 * Best-effort auto-load of a .env file from common locations so the CLI
 * runs without wrapping `node --env-file=...`. Existing shell env wins
 * (loading is skipped when a required var is already set).
 */
function tryAutoLoadEnv(): void {
  if (process.env.CMS_BASE_URL !== undefined && process.env.CMS_BASE_URL !== '') return;
  // Ordered by the most common cwd for each invocation style:
  //   ./.env            running from project root
  //   ../../.env        running from apps/cli via tsx
  //   ../../../.env     running from apps/cli/dist
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
