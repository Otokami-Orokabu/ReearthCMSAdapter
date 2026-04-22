import { describe, it, expect } from 'vitest';
import { flattenFields, toCmsFields, makePointGeometry } from '../src/mappers.js';
import type { CmsItem } from '../src/types.js';

describe('makePointGeometry', () => {
  it('returns GeoJSON Point with [lng, lat] order', () => {
    expect(makePointGeometry(139, 35)).toEqual({
      type: 'Point',
      coordinates: [139, 35],
    });
  });

  it('handles negative coordinates', () => {
    expect(makePointGeometry(-74.0, 40.7)).toEqual({
      type: 'Point',
      coordinates: [-74.0, 40.7],
    });
  });

  it('handles zero coordinates', () => {
    expect(makePointGeometry(0, 0)).toEqual({
      type: 'Point',
      coordinates: [0, 0],
    });
  });
});

describe('toCmsFields', () => {
  it('converts dict to CmsField array', () => {
    expect(
      toCmsFields({
        title: { type: 'text', value: 'Hi' },
        count: { type: 'integer', value: 42 },
      }),
    ).toEqual([
      { key: 'title', type: 'text', value: 'Hi' },
      { key: 'count', type: 'integer', value: 42 },
    ]);
  });

  it('returns empty array for empty dict', () => {
    expect(toCmsFields({})).toEqual([]);
  });

  it('preserves insertion order', () => {
    const result = toCmsFields({
      a: { type: 'text', value: '1' },
      b: { type: 'text', value: '2' },
      c: { type: 'text', value: '3' },
    });
    expect(result.map((f) => f.key)).toEqual(['a', 'b', 'c']);
  });

  it('passes complex values through untouched', () => {
    const geometry = { type: 'Point' as const, coordinates: [1, 2] };
    const result = toCmsFields({
      location: { type: 'geometryObject', value: geometry },
    });
    expect(result[0]?.value).toBe(geometry);
  });
});

describe('flattenFields', () => {
  it('merges fields array into flat object', () => {
    const item: CmsItem = {
      id: 'item1',
      fields: [
        { key: 'title', type: 'text', value: 'Hello' },
        { key: 'count', type: 'integer', value: 5 },
      ],
    };
    expect(flattenFields(item)).toEqual({
      id: 'item1',
      title: 'Hello',
      count: 5,
    });
  });

  it('includes timestamps when present', () => {
    const item: CmsItem = {
      id: 'item1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      fields: [],
    };
    expect(flattenFields(item)).toEqual({
      id: 'item1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    });
  });

  it('omits timestamps when absent', () => {
    const item: CmsItem = { id: 'item1', fields: [] };
    expect(flattenFields(item)).toEqual({ id: 'item1' });
  });

  it('returns {id} for empty fields array', () => {
    const item: CmsItem = { id: 'x', fields: [] };
    expect(flattenFields(item)).toEqual({ id: 'x' });
  });

  it('preserves field value types (GeoJSON, number, string)', () => {
    const geom = { type: 'Point' as const, coordinates: [1, 2] };
    const item: CmsItem = {
      id: 'x',
      fields: [
        { key: 'loc', type: 'geometryObject', value: geom },
        { key: 'n', type: 'integer', value: 42 },
        { key: 's', type: 'text', value: 'hello' },
      ],
    };
    interface Out {
      id: string;
      loc: { type: 'Point'; coordinates: number[] };
      n: number;
      s: string;
    }
    const flat = flattenFields<Out>(item);
    expect(flat.loc).toBe(geom);
    expect(flat.n).toBe(42);
    expect(flat.s).toBe('hello');
  });
});
