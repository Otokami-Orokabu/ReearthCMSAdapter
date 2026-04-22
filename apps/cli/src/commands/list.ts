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
 * `reearth-cms list <model> [--limit N] [--bbox ...] [--sort field[:order]] [--json]`
 *
 * Lists items for a CMS model via the Public API. All filter / sort /
 * slicing runs client-side inside the Core ACL; see Core `types.ts`
 * `ListOpts` for semantics.
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List items for a CMS model (Public API)')
    .argument('<model>', 'Model key (e.g. hazzrd_reports)')
    .option('--limit <n>', 'Maximum number of items to return', parsePositiveInt)
    .option('--offset <n>', 'Skip the first N items (after filter/sort)', parsePositiveInt)
    .option(
      '--bbox <lng1,lat1,lng2,lat2>',
      'Keep only items inside this geographic bounding box',
      parseBboxOpt,
    )
    .option(
      '--sort <field[:asc|desc]>',
      'Sort by item field (client-side)',
      parseSortOpt,
    )
    .option('--json', 'Output full items as JSON')
    .action(
      async (
        model: string,
        options: {
          limit?: number;
          offset?: number;
          bbox?: Bbox;
          sort?: SortSpec;
          json?: boolean;
        },
      ) => {
        const config = loadConfig();
        const client = createClient(config);

        const listOpts: ListOpts = {
          ...(options.limit !== undefined ? { limit: options.limit } : {}),
          ...(options.offset !== undefined ? { offset: options.offset } : {}),
          ...(options.bbox !== undefined ? { bbox: options.bbox } : {}),
          ...(options.sort !== undefined ? { sort: options.sort } : {}),
        };
        const items = await client.listItems<Record<string, unknown>>(model, listOpts);

        if (options.json === true) {
          process.stdout.write(`${JSON.stringify(items, null, 2)}\n`);
          return;
        }

        if (items.length === 0) {
          process.stdout.write('(no items)\n');
          return;
        }

        for (const item of items) {
          const id = typeof item.id === 'string' ? item.id : '?';
          const title =
            typeof item.title === 'string' && item.title.length > 0
              ? item.title
              : '(no title)';
          process.stdout.write(`${id}\t${title}\n`);
        }
      },
    );
}
