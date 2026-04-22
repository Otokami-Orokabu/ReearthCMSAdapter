import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * `reearth-cms publish <model> <id>`
 *
 * Publishes a draft item so it becomes visible via the Public API.
 * Required model argument — the Integration API publish endpoint is
 * model-scoped.
 */
export function registerPublishCommand(program: Command): void {
  program
    .command('publish')
    .description('Publish a draft item (makes it visible via Public API)')
    .argument('<model>', 'Model key or id')
    .argument('<id>', 'Item id')
    .action(async (model: string, id: string) => {
      const client = createClient(loadConfig());
      await client.publishItem(model, id);
      process.stdout.write(`published ${id}\n`);
    });
}
