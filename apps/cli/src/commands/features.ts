import type { Command } from 'commander';
import { createClient } from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { attachListOptions, buildListOpts, type ParsedListOptions } from '../optParsers.js';

/**
 * reearth-cms features <model> [--bbox ...] [--sort ...] [--limit N]
 *
 * Fetch items as a GeoJSON FeatureCollection and write it to stdout.
 * Items without a Point location are excluded server-side by the CMS.
 */
export function registerFeaturesCommand(program: Command): void {
  const cmd = program
    .command('features')
    .description('Fetch items as a GeoJSON FeatureCollection')
    .argument('<model>', 'Model key (e.g. hazzrd_reports)');
  attachListOptions(cmd, 'features').action(
    async (model: string, options: ParsedListOptions) => {
      const client = createClient(loadConfig());
      const listOpts = buildListOpts(options);
      const fc = await client.listFeatures(model, listOpts);
      process.stdout.write(`${JSON.stringify(fc, null, 2)}\n`);
    },
  );
}
