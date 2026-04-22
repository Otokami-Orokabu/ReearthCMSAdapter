import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { parsePayload } from '../payload.js';

/**
 * `reearth-cms create <model> [--data | --file | --title]`
 *
 * Creates a new item via the Integration API. Payload is supplied through
 * exactly one of: inline JSON (`--data`), JSON file (`--file`), or the
 * single-field shortcut (`--title`). See {@link parsePayload} for details.
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
