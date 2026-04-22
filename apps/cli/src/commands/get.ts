import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * `reearth-cms get <model> <id>`
 *
 * Fetches a single item via the Public API. Exits with code 1 and a clear
 * message when the item is not found (HTTP 404 → `null`).
 */
export function registerGetCommand(program: Command): void {
  program
    .command('get')
    .description('Get a single item by id (Public API)')
    .argument('<model>', 'Model key (e.g. hazzrd_reports)')
    .argument('<id>', 'Item id')
    .action(async (model: string, id: string) => {
      const client = createClient(loadConfig());
      const item = await client.getItem<Record<string, unknown>>(model, id);
      if (item === null) {
        process.stderr.write(`error: item ${id} not found in ${model}\n`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
    });
}
