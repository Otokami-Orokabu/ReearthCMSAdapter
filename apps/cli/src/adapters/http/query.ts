import type { ListOpts } from '@hw/reearth-api-server';
import { parseBboxOpt, parseSortOpt, parsePositiveInt } from '../../optParsers.js';

/**
 * Parse Express `req.query` into a Core {@link ListOpts}.
 *
 * Supported query params:
 * - `limit`  : positive integer
 * - `offset` : positive integer (actually non-negative, but we reuse parser)
 * - `bbox`   : `"lng1,lat1,lng2,lat2"`
 * - `sort`   : `"field"` or `"field:asc|desc"`
 *
 * Unknown or malformed values throw a boundary `Error` with a user-friendly
 * message; route handlers should catch and respond 400.
 */
export function parseListQuery(query: unknown): ListOpts {
  const opts: ListOpts = {};
  if (typeof query !== 'object' || query === null) return opts;
  const q = query as Record<string, unknown>;

  const limit = readString(q.limit);
  if (limit !== null) opts.limit = parsePositiveInt(limit);

  const offset = readString(q.offset);
  if (offset !== null) {
    const n = Number.parseInt(offset, 10);
    if (!Number.isFinite(n) || n < 0) throw new Error(`offset must be >= 0, got "${offset}"`);
    opts.offset = n;
  }

  const bbox = readString(q.bbox);
  if (bbox !== null) opts.bbox = parseBboxOpt(bbox);

  const sort = readString(q.sort);
  if (sort !== null) opts.sort = parseSortOpt(sort);

  return opts;
}

/** Accept a single string; ignore arrays / non-strings. */
function readString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  if (v.length === 0) return null;
  return v;
}
