import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * reearth-cms schema <id-or-key>
 *
 * Dump the raw JSON Schema of a model. Exits with code 1 when the model
 * is not found.
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Dump raw JSON Schema of a model (Integration API)')
    .argument('<id-or-key>', 'Model id (UUID) or key')
    .action(async (idOrKey: string) => {
      const client = createClient(loadConfig());
      const schema = await client.getJsonSchema(idOrKey);
      if (schema === null) {
        process.stderr.write(`error: model "${idOrKey}" not found\n`);
        process.exit(1);
      }
      process.stdout.write(`${JSON.stringify(schema, null, 2)}\n`);
    });
}
