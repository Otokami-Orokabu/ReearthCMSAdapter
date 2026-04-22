import type { Bbox, SortSpec } from '@hw/reearth-api-server';

/**
 * Parse a positive integer option value. Used by `--limit` / `--count` etc.
 */
export function parsePositiveInt(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`Expected a positive integer, got "${raw}"`);
  }
  return n;
}

/**
 * Parse a `--bbox` option string `"lng1,lat1,lng2,lat2"` into a {@link Bbox}.
 * Swaps endpoints if given in reverse order so `[min, max]` is guaranteed.
 */
export function parseBboxOpt(raw: string): Bbox {
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--bbox must be "lng1,lat1,lng2,lat2" numeric, got "${raw}"`);
  }
  const [a, b, c, d] = parts as [number, number, number, number];
  return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
}

/**
 * Parse a `--sort` option string `"field"` or `"field:order"` into a {@link SortSpec}.
 * Order accepts `asc` / `desc`; defaults to `asc`.
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
