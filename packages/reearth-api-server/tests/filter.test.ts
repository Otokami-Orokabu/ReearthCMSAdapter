import { describe, it, expect } from 'vitest';
import {
  applyListOps,
  filterByBbox,
  filterByRadius,
  haversineMeters,
  sortBy,
  slice,
} from '../src/filter.js';
import type { Bbox, NearSpec } from '../src/types.js';

describe('filterByBbox', () => {
  const bbox: Bbox = [130, 33, 141, 42]; // Japan mainland-ish

  const getCoords = (item: { lng: number; lat: number } | { noCoords: true }): readonly [number, number] | null =>
    'lng' in item ? [item.lng, item.lat] : null;

  it('keeps items whose coords are inside the bbox', () => {
    const items = [
      { lng: 139.7, lat: 35.7 }, // Tokyo
      { lng: 135.5, lat: 34.7 }, // Osaka
    ];
    expect(filterByBbox(items, bbox, getCoords)).toEqual(items);
  });

  it('excludes items outside the bbox', () => {
    const items = [
      { lng: 139.7, lat: 35.7 }, // in
      { lng: 0, lat: 0 }, // out
      { lng: -74, lat: 40.7 }, // NYC, out
    ];
    const result = filterByBbox(items, bbox, getCoords);
    expect(result).toHaveLength(1);
  });

  it('excludes items whose extractor returns null', () => {
    const items: Array<{ lng: number; lat: number } | { noCoords: true }> = [
      { lng: 139.7, lat: 35.7 },
      { noCoords: true },
    ];
    expect(filterByBbox(items, bbox, getCoords)).toHaveLength(1);
  });

  it('includes items exactly on the bbox boundary', () => {
    const items = [
      { lng: 130, lat: 33 },
      { lng: 141, lat: 42 },
    ];
    expect(filterByBbox(items, bbox, getCoords)).toHaveLength(2);
  });

  it('returns an empty array when bbox matches nothing', () => {
    const items = [{ lng: 0, lat: 0 }];
    expect(filterByBbox(items, bbox, getCoords)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const items = [{ lng: 139.7, lat: 35.7 }];
    const ref = items;
    filterByBbox(items, bbox, getCoords);
    expect(items).toBe(ref);
    expect(items).toHaveLength(1);
  });
});

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(139.7, 35.7, 139.7, 35.7)).toBe(0);
  });

  it('approximates known distances (Tokyo ↔ Osaka, ~400km)', () => {
    const tokyo: [number, number] = [139.7671, 35.6812];
    const osaka: [number, number] = [135.5023, 34.6937];
    const d = haversineMeters(tokyo[0], tokyo[1], osaka[0], osaka[1]);
    // Known distance ≈ 400km, allow 10km tolerance for spherical approximation
    expect(d).toBeGreaterThan(390_000);
    expect(d).toBeLessThan(410_000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(139, 35, 135, 34);
    const b = haversineMeters(135, 34, 139, 35);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('filterByRadius', () => {
  const getCoords = (p: { lng: number; lat: number }): readonly [number, number] => [p.lng, p.lat];
  const tokyo: NearSpec = { lng: 139.7671, lat: 35.6812, radius: 50_000 }; // 50km around Tokyo

  it('keeps items within the radius', () => {
    const shibuya = { lng: 139.7, lat: 35.66 }; // ~6km from center
    const yokohama = { lng: 139.638, lat: 35.444 }; // ~30km from center
    const items = [shibuya, yokohama];
    expect(filterByRadius(items, tokyo, getCoords)).toHaveLength(2);
  });

  it('excludes items outside the radius', () => {
    const nagoya = { lng: 136.906, lat: 35.181 }; // ~270km from Tokyo
    const items = [nagoya];
    expect(filterByRadius(items, tokyo, getCoords)).toHaveLength(0);
  });

  it('excludes items whose extractor returns null', () => {
    const items: Array<{ lng: number; lat: number } | { noCoords: true }> = [
      { lng: 139.7, lat: 35.66 },
      { noCoords: true },
    ];
    const extract = (p: { lng: number; lat: number } | { noCoords: true }) =>
      'lng' in p ? ([p.lng, p.lat] as const) : null;
    expect(filterByRadius(items, tokyo, extract)).toHaveLength(1);
  });

  it('zero-radius keeps only an exact match', () => {
    const spec: NearSpec = { lng: 139, lat: 35, radius: 0 };
    const items = [
      { lng: 139, lat: 35 },
      { lng: 139.0001, lat: 35 },
    ];
    expect(filterByRadius(items, spec, getCoords)).toHaveLength(1);
  });
});

describe('sortBy', () => {
  const getValue = (item: Record<string, unknown>, field: string): unknown => item[field];

  it('sorts strings ascending by default', () => {
    const items = [{ title: 'c' }, { title: 'a' }, { title: 'b' }];
    expect(sortBy(items, { field: 'title' }, getValue).map((i) => i.title)).toEqual(['a', 'b', 'c']);
  });

  it('sorts strings descending when specified', () => {
    const items = [{ title: 'c' }, { title: 'a' }, { title: 'b' }];
    expect(sortBy(items, { field: 'title', order: 'desc' }, getValue).map((i) => i.title)).toEqual(['c', 'b', 'a']);
  });

  it('sorts numbers numerically (not lexically)', () => {
    const items = [{ n: 10 }, { n: 2 }, { n: 30 }];
    expect(sortBy(items, { field: 'n' }, getValue).map((i) => i.n)).toEqual([2, 10, 30]);
  });

  it('sorts ISO date strings chronologically', () => {
    const items = [
      { createdAt: '2026-01-03T00:00:00Z' },
      { createdAt: '2026-01-01T00:00:00Z' },
      { createdAt: '2026-01-02T00:00:00Z' },
    ];
    const result = sortBy(items, { field: 'createdAt' }, getValue).map((i) => i.createdAt);
    expect(result).toEqual([
      '2026-01-01T00:00:00Z',
      '2026-01-02T00:00:00Z',
      '2026-01-03T00:00:00Z',
    ]);
  });

  it('pushes undefined / null values to the end', () => {
    const items = [{ x: 2 }, { x: undefined }, { x: 1 }];
    expect(sortBy(items, { field: 'x' }, getValue).map((i) => i.x)).toEqual([1, 2, undefined]);
  });

  it('does not mutate the input array', () => {
    const items = [{ t: 'c' }, { t: 'a' }];
    const ref = [...items];
    sortBy(items, { field: 't' }, getValue);
    expect(items).toEqual(ref);
  });
});

describe('applyListOps', () => {
  const items = [
    { id: 'a', title: 'banana', lng: 139.7, lat: 35.7 }, // Tokyo
    { id: 'b', title: 'apple', lng: 135.5, lat: 34.7 }, // Osaka
    { id: 'c', title: 'cherry', lng: 0, lat: 0 }, // origin, outside any Japan bbox/near
    { id: 'd', title: 'date' }, // no coords
  ];
  const getCoords = (i: (typeof items)[number]): readonly [number, number] | null =>
    'lng' in i && 'lat' in i && i.lng !== undefined && i.lat !== undefined
      ? [i.lng, i.lat]
      : null;
  const getField = (i: (typeof items)[number], f: string): unknown =>
    (i as unknown as Record<string, unknown>)[f];

  it('returns a copy when opts is undefined', () => {
    const out = applyListOps(items, undefined, getCoords, getField);
    expect(out).toHaveLength(items.length);
    expect(out).not.toBe(items);
  });

  it('applies near then sort then limit in order', () => {
    const near: NearSpec = { lng: 139, lat: 35, radius: 500_000 }; // ~500km from (139,35): Tokyo & Osaka
    const out = applyListOps(
      items,
      { near, sort: { field: 'title' }, limit: 1 },
      getCoords,
      getField,
    );
    // Tokyo + Osaka pass near. Sorted ascending by title: apple(b), banana(a). Limit=1 → [b]
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('b');
  });

  it('bbox narrows after near (intersection)', () => {
    const near: NearSpec = { lng: 139, lat: 35, radius: 1_000_000 };
    const bbox: Bbox = [139, 35, 140, 36]; // only Tokyo
    const out = applyListOps(items, { near, bbox }, getCoords, getField);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('sort without filters keeps every item', () => {
    const out = applyListOps(items, { sort: { field: 'title' } }, getCoords, getField);
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c', 'd']); // apple, banana, cherry, date
  });
});

describe('slice', () => {
  const items = [1, 2, 3, 4, 5];

  it('returns all items when neither offset nor limit is set', () => {
    expect(slice(items, {})).toEqual([1, 2, 3, 4, 5]);
  });

  it('applies limit from the start', () => {
    expect(slice(items, { limit: 3 })).toEqual([1, 2, 3]);
  });

  it('applies offset without limit', () => {
    expect(slice(items, { offset: 2 })).toEqual([3, 4, 5]);
  });

  it('applies both offset and limit', () => {
    expect(slice(items, { offset: 1, limit: 2 })).toEqual([2, 3]);
  });

  it('handles limit larger than remaining items', () => {
    expect(slice(items, { offset: 3, limit: 100 })).toEqual([4, 5]);
  });

  it('returns a new array, not the input', () => {
    const out = slice(items, {});
    expect(out).not.toBe(items);
  });
});
