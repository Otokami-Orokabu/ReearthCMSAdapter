import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * reearth-cms get <model> <id>
 *
 * Fetch a single item via the Public API and write it as JSON to stdout.
 * Exits with code 1 when the item is not found.
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
