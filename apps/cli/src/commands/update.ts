import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { parsePayload } from '../payload.js';

/**
 * reearth-cms update <id> [--data | --file | --title]
 *
 * Partial update: only fields listed in the payload are modified;
 * others are kept as-is.
 */
export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update an existing item by id (Integration API)')
    .argument('<id>', 'Item id')
    .option('--data <json>', 'Payload as inline JSON string')
    .option('--file <path>', 'Payload from a JSON file')
    .option('--title <text>', 'Shortcut: update only { title: text }')
    .action(
      async (
        id: string,
        options: { data?: string; file?: string; title?: string },
      ) => {
        const payload = parsePayload(options);
        const client = createClient(loadConfig());
        const updated = await client.updateItem<Record<string, unknown>>(id, payload);
        process.stdout.write(`${JSON.stringify(updated, null, 2)}\n`);
      },
    );
}
