import { describe, it, expect } from 'vitest';
import { filterByBbox, sortBy, slice } from '../src/filter.js';
import type { Bbox } from '../src/types.js';

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
