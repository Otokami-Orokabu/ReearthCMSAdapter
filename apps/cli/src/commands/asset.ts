import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';

/**
 * reearth-cms asset <id> [--json]
 *
 * Get a single asset record by id. Default output is "id url";
 * --json emits the full asset object. Exits with code 1 when the asset
 * is not found.
 */
export function registerAssetCommand(program: Command): void {
  program
    .command('asset')
    .description('Get a single asset by id (Integration API)')
    .argument('<id>', 'Asset id (UUID)')
    .option('--json', 'Output the full asset object as JSON')
    .action(async (id: string, options: { json?: boolean }) => {
      const client = createClient(loadConfig());
      const asset = await client.getAsset(id);
      if (asset === null) {
        process.stderr.write(`error: asset "${id}" not found\n`);
        process.exit(1);
      }
      if (options.json === true) {
        process.stdout.write(`${JSON.stringify(asset, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${asset.id}\t${asset.url}\n`);
    });
}
