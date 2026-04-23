import type { Command } from 'commander';
import type { Bbox, ListOpts, NearSpec, SortSpec } from '@hw/reearth-api-server';

/** Parse a positive integer option value (throws on <= 0 or non-numeric). */
export function parsePositiveInt(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Expected a positive integer, got "${raw}"`);
  }
  return n;
}

function isValidLng(n: number): boolean {
  return n >= -180 && n <= 180;
}

function isValidLat(n: number): boolean {
  return n >= -90 && n <= 90;
}

/**
 * Parse a --bbox option string "lng1,lat1,lng2,lat2" into a Bbox.
 * Endpoints are swapped when given in reverse order so the result
 * always satisfies [min, max].
 */
export function parseBboxOpt(raw: string): Bbox {
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--bbox must be "lng1,lat1,lng2,lat2" numeric, got "${raw}"`);
  }
  const [a, b, c, d] = parts as [number, number, number, number];
  if (!isValidLng(a) || !isValidLng(c)) {
    throw new Error(`--bbox longitudes must be in [-180, 180], got "${raw}"`);
  }
  if (!isValidLat(b) || !isValidLat(d)) {
    throw new Error(`--bbox latitudes must be in [-90, 90], got "${raw}"`);
  }
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/**
 * Parse a --near option string "lng,lat,radius_m" into a NearSpec.
 * Radius must be non-negative (0 matches exact coordinates only).
 */
export function parseNearOpt(raw: string): NearSpec {
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--near must be "lng,lat,radius_m" numeric, got "${raw}"`);
  }
  const [lng, lat, radius] = parts as [number, number, number];
  if (!isValidLng(lng)) {
    throw new Error(`--near longitude must be in [-180, 180], got ${String(lng)}`);
  }
  if (!isValidLat(lat)) {
    throw new Error(`--near latitude must be in [-90, 90], got ${String(lat)}`);
  }
  if (radius < 0) {
    throw new Error(`--near radius must be >= 0 meters, got ${String(radius)}`);
  }
  return { lng, lat, radius };
}

/** Parsed shape returned by the shared list / features options. Each
 *  field is optional and maps 1:1 to a ListOpts field. */
export interface ParsedListOptions {
  limit?: number;
  offset?: number;
  bbox?: Bbox;
  near?: NearSpec;
  sort?: SortSpec;
}

/** Assemble a ListOpts from parsed CLI options, dropping undefined keys
 *  so exactOptionalPropertyTypes stays happy. */
export function buildListOpts(opts: ParsedListOptions): ListOpts {
  return {
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
    ...(opts.offset !== undefined ? { offset: opts.offset } : {}),
    ...(opts.bbox !== undefined ? { bbox: opts.bbox } : {}),
    ...(opts.near !== undefined ? { near: opts.near } : {}),
    ...(opts.sort !== undefined ? { sort: opts.sort } : {}),
  };
}

/**
 * Attach the shared --limit / --offset / --bbox / --near / --sort options
 * to a Commander subcommand. `nounSingular` tweaks the help text.
 */
export function attachListOptions(cmd: Command, nounSingular: 'items' | 'features'): Command {
  return cmd
    .option('--limit <n>', `Maximum number of ${nounSingular} to return`, parsePositiveInt)
    .option(
      '--offset <n>',
      `Skip the first N ${nounSingular} (after filter/sort)`,
      parsePositiveInt,
    )
    .option(
      '--bbox <lng1,lat1,lng2,lat2>',
      `Keep only ${nounSingular} inside this geographic bounding box`,
      parseBboxOpt,
    )
    .option(
      '--near <lng,lat,radius_m>',
      `Keep only ${nounSingular} within <radius_m> meters of <lng,lat>`,
      parseNearOpt,
    )
    .option(
      '--sort <field[:asc|desc]>',
      'Sort by field (client-side)',
      parseSortOpt,
    );
}

/**
 * Parse a --sort option string "field" or "field:order" into a SortSpec.
 * Order accepts asc or desc; absent order defaults to asc.
 */
export function parseSortOpt(raw: string): SortSpec {
  const [field, orderRaw] = raw.split(':').map((s) => s.trim());
  if (field === undefined || field.length === 0) {
    throw new Error(`--sort must be "field" or "field:asc|desc", got "${raw}"`);
  }
  if (orderRaw === undefined || orderRaw.length === 0) {
    return { field };
  }
  if (orderRaw !== 'asc' && orderRaw !== 'desc') {
    throw new Error(`--sort order must be "asc" or "desc", got "${orderRaw}"`);
  }
  return { field, order: orderRaw };
}
