import type { Command } from 'commander';
import {
  createClient,
  type Bbox,
  type SortSpec,
  type ListOpts,
} from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { parsePositiveInt, parseBboxOpt, parseSortOpt } from '../optParsers.js';

/**
 * `reearth-cms features <model> [--bbox ...] [--sort ...] [--limit N]`
 *
 * Fetch items as a **GeoJSON FeatureCollection** via the `.geojson` variant
 * of the Re:Earth CMS Public API. Items without a valid Point location are
 * excluded by the CMS server-side.
 *
 * Default output is the FeatureCollection JSON on stdout (suitable for
 * redirecting to a file or piping to a map library).
 */
export function registerFeaturesCommand(program: Command): void {
  program
    .command('features')
    .description(
      'Fetch items as GeoJSON FeatureCollection (uses the `.geojson` variant of Public API)',
    )
    .argument('<model>', 'Model key (e.g. hazzrd_reports)')
    .option('--limit <n>', 'Maximum number of features to return', parsePositiveInt)
    .option('--offset <n>', 'Skip the first N features (after filter/sort)', parsePositiveInt)
    .option(
      '--bbox <lng1,lat1,lng2,lat2>',
      'Keep only features inside this geographic bounding box',
      parseBboxOpt,
    )
    .option(
      '--sort <field[:asc|desc]>',
      'Sort by `id` or `properties.<field>` (client-side)',
      parseSortOpt,
    )
    .action(
      async (
        model: string,
        options: {
          limit?: number;
          offset?: number;
          bbox?: Bbox;
          sort?: SortSpec;
        },
      ) => {
        const client = createClient(loadConfig());
        const listOpts: ListOpts = {
          ...(options.limit !== undefined ? { limit: options.limit } : {}),
          ...(options.offset !== undefined ? { offset: options.offset } : {}),
          ...(options.bbox !== undefined ? { bbox: options.bbox } : {}),
          ...(options.sort !== undefined ? { sort: options.sort } : {}),
        };
        const fc = await client.listFeatures(model, listOpts);
        process.stdout.write(`${JSON.stringify(fc, null, 2)}\n`);
      },
    );
}
