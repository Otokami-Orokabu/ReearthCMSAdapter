import type { Command } from 'commander';
import {
  createClient,
  makePointGeometry,
  type Bbox,
  type CmsPayload,
} from '@hw/reearth-api-server';
import { loadConfig } from '../config.js';
import { parsePositiveInt, parseBboxOpt } from '../optParsers.js';

/** Default bounding box for random Point locations: rough Japan mainland. */
const DEFAULT_BBOX: Bbox = [130.0, 33.0, 141.0, 42.0];

/**
 * reearth-cms seed <model> [--count N] [--bbox ...] [--category ...]
 *                          [--status ...]
 *
 * Bulk-create items for testing. Each item gets a timestamped title, a
 * random Point location within --bbox, and optional select values from
 * --category / --status. Items land as draft and must be published to
 * appear via the Public API.
 */
export function registerSeedCommand(program: Command): void {
  program
    .command('seed')
    .description('Bulk-create random items for testing (Integration API)')
    .argument('<model>', 'Model key or id')
    .option('--count <n>', 'Number of items to create', parsePositiveInt, 10)
    .option(
      '--bbox <lng1,lat1,lng2,lat2>',
      'Bounding box for random Point locations (default: Japan mainland)',
      parseBboxOpt,
    )
    .option(
      '--category <list>',
      'Comma-separated category values to pick from (field: "category", type: select)',
    )
    .option(
      '--status <list>',
      'Comma-separated status values to pick from (field: "status", type: select)',
    )
    .action(
      async (
        model: string,
        options: {
          count: number;
          bbox?: Bbox;
          category?: string;
          status?: string;
        },
      ) => {
        const bbox = options.bbox ?? DEFAULT_BBOX;
        const [minLng, minLat, maxLng, maxLat] = bbox;
        const categories = options.category?.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        const statuses = options.status?.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

        const client = createClient(loadConfig());
        const batchStamp = Date.now();

        process.stdout.write(
          `Seeding ${String(options.count)} items into "${model}"...\n`,
        );

        let succeeded = 0;
        let failed = 0;
        for (let i = 1; i <= options.count; i++) {
          const lng = randomInRange(minLng, maxLng);
          const lat = randomInRange(minLat, maxLat);

          const payload: CmsPayload = {
            title: { type: 'text', value: `seed-${String(batchStamp)}-${String(i)}` },
            location: { type: 'geometryObject', value: makePointGeometry(lng, lat) },
          };
          if (categories !== undefined && categories.length > 0) {
            payload.category = { type: 'select', value: pickRandom(categories) };
          }
          if (statuses !== undefined && statuses.length > 0) {
            payload.status = { type: 'select', value: pickRandom(statuses) };
          }

          try {
            const created = await client.createItem<Record<string, unknown>>(model, payload);
            const id = typeof created.id === 'string' ? created.id : '?';
            succeeded++;
            process.stdout.write(
              `  [${String(i)}/${String(options.count)}] ${id}\n`,
            );
          } catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`  [${String(i)}/${String(options.count)}] FAILED: ${msg}\n`);
          }
        }

        process.stdout.write(
          `Done. succeeded=${String(succeeded)} failed=${String(failed)}\n`,
        );
        if (failed > 0) process.exit(1);
      },
    );
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pickRandom<T>(arr: readonly T[]): T {
  const idx = Math.floor(Math.random() * arr.length);
  const v = arr[idx];
  if (v === undefined) throw new Error('unreachable: empty array');
  return v;
}
