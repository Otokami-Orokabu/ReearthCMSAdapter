import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { parsePayload } from '../payload.js';

/**
 * reearth-cms create <model> [--data | --file | --title]
 *
 * Create a new item via the Integration API. The payload source is
 * exactly one of --data (inline JSON), --file (JSON file path), or
 * --title (single-field shortcut).
 */
export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create an item (Integration API)')
    .argument('<model>', 'Model key or id')
    .option('--data <json>', 'Payload as inline JSON string')
    .option('--file <path>', 'Payload from a JSON file')
    .option('--title <text>', 'Shortcut: create with only { title: text }')
    .action(
      async (
        model: string,
        options: { data?: string; file?: string; title?: string },
      ) => {
        const payload = parsePayload(options);
        const client = createClient(loadConfig());
        const created = await client.createItem<Record<string, unknown>>(model, payload);
        process.stdout.write(`${JSON.stringify(created, null, 2)}\n`);
      },
    );
}
