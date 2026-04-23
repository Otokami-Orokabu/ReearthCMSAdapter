import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * reearth-cms bbox <model> [--json]
 *
 * Compute the bounding box that encloses every Point-located item in a
 * model. Default output is a comma-joined line "lng1,lat1,lng2,lat2";
 * --json prints a 4-element JSON array. Exits with code 1 when the
 * model has no Point-located items.
 */
export function registerBboxCommand(program: Command): void {
  program
    .command('bbox')
    .description('Compute bounding box of a model (Public API)')
    .argument('<model>', 'Model key or id')
    .option('--json', 'Output as a JSON tuple [lng1,lat1,lng2,lat2]')
    .action(async (model: string, options: { json?: boolean }) => {
      const client = createClient(loadConfig());
      const bbox = await client.getBounds(model);
      if (bbox === null) {
        process.stderr.write(`error: no Point-located items in "${model}"\n`);
        process.exit(1);
      }
      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(bbox)}\n`);
        return;
      }
      process.stdout.write(`${bbox.join(',')}\n`);
    });
}
