import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * `reearth-cms models [--json]`
 *
 * Lists all models in the configured project via the Integration API.
 * Default output is a compact three-column table (id / key / name).
 */
export function registerModelsCommand(program: Command): void {
  program
    .command('models')
    .description('List models in the configured project (Integration API)')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      const client = createClient(loadConfig());
      const models = await client.listModels();

      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(models, null, 2)}\n`);
        return;
      }

      if (models.length === 0) {
        process.stdout.write('(no models)\n');
        return;
      }
      for (const m of models) {
        process.stdout.write(`${m.id}\t${m.key}\t${m.name}\n`);
      }
    });
}
