import { describe, it, expect } from 'vitest';
import { normalizeItem, normalizeField } from '../src/integration/items.js';
import { normalizeAsset } from '../src/integration/assets.js';
import { extractSchemaFields } from '../src/integration/internal/schemaParse.js';
import { ReearthApiError } from '../src/errors.js';

describe('normalizeItem', () => {
  it('accepts a minimal valid item (id + empty fields array)', () => {
    const item = normalizeItem({ id: 'abc', fields: [] });
    expect(item).toEqual({ id: 'abc', fields: [] });
  });

  it('preserves createdAt / updatedAt when strings', () => {
    const item = normalizeItem({
      id: 'abc',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      fields: [],
    });
    expect(item.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(item.updatedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('drops createdAt / updatedAt when non-string (defensive)', () => {
    const item = normalizeItem({
      id: 'abc',
      createdAt: 123,
      updatedAt: null,
      fields: [],
    });
    expect(item.createdAt).toBeUndefined();
    expect(item.updatedAt).toBeUndefined();
  });

  it('preserves metadataFields array', () => {
    const item = normalizeItem({
      id: 'abc',
      fields: [],
      metadataFields: [{ key: 'status', type: 'text', value: 'draft' }],
    });
    expect(item.metadataFields).toHaveLength(1);
    expect(item.metadataFields?.[0]).toEqual({
      key: 'status',
      type: 'text',
      value: 'draft',
    });
  });

  it('preserves referencedItems (recursive normalization)', () => {
    const item = normalizeItem({
      id: 'abc',
      fields: [],
      referencedItems: [{ id: 'ref-1', fields: [{ key: 't', type: 'text', value: 'x' }] }],
    });
    expect(item.referencedItems).toHaveLength(1);
    expect(item.referencedItems?.[0]?.id).toBe('ref-1');
    expect(item.referencedItems?.[0]?.fields[0]?.value).toBe('x');
  });

  it('throws when response is not an object', () => {
    expect(() => normalizeItem(null)).toThrow(ReearthApiError);
    expect(() => normalizeItem('string')).toThrow(ReearthApiError);
    expect(() => normalizeItem([])).toThrow(ReearthApiError);
  });

  it('throws when id is missing or non-string', () => {
    expect(() => normalizeItem({ fields: [] })).toThrow(/missing "id"/);
    expect(() => normalizeItem({ id: 123, fields: [] })).toThrow(/missing "id"/);
  });

  it('throws when fields is not an array', () => {
    expect(() => normalizeItem({ id: 'abc' })).toThrow(/missing "fields"/);
    expect(() => normalizeItem({ id: 'abc', fields: 'nope' })).toThrow(/missing "fields"/);
  });
});

describe('normalizeField', () => {
  it('accepts a known CmsFieldType value', () => {
    const field = normalizeField({ key: 't', type: 'text', value: 'hello' });
    expect(field).toEqual({ key: 't', type: 'text', value: 'hello' });
  });

  it('accepts an unknown type string (widened contract)', () => {
    const field = normalizeField({ key: 't', type: 'geometryEditor', value: null });
    expect(field.type).toBe('geometryEditor');
  });

  it('passes through arbitrary value shapes', () => {
    const field = normalizeField({
      key: 'loc',
      type: 'geometryObject',
      value: { type: 'Point', coordinates: [139, 35] },
    });
    expect(field.value).toEqual({ type: 'Point', coordinates: [139, 35] });
  });

  it('throws when not an object', () => {
    expect(() => normalizeField(null)).toThrow(ReearthApiError);
    expect(() => normalizeField([])).toThrow(ReearthApiError);
  });

  it('throws when key / type missing or non-string', () => {
    expect(() => normalizeField({ type: 'text', value: 'x' })).toThrow(/missing "key" or "type"/);
    expect(() => normalizeField({ key: 't', value: 'x' })).toThrow(/missing "key" or "type"/);
    expect(() => normalizeField({ key: 't', type: 42, value: 'x' })).toThrow(
      /missing "key" or "type"/,
    );
  });
});

describe('normalizeAsset', () => {
  it('accepts a minimal valid asset', () => {
    const asset = normalizeAsset({
      id: 'a1',
      url: 'https://cms/a1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    expect(asset).toEqual({
      id: 'a1',
      url: 'https://cms/a1',
      public: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('copies optional fields when present', () => {
    const asset = normalizeAsset({
      id: 'a1',
      url: 'https://cms/a1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      public: true,
      name: 'logo.png',
      contentType: 'image/png',
      totalSize: 2048,
    });
    expect(asset.public).toBe(true);
    expect(asset.name).toBe('logo.png');
    expect(asset.contentType).toBe('image/png');
    expect(asset.totalSize).toBe(2048);
  });

  it('throws when required field is missing', () => {
    expect(() => normalizeAsset({ id: 'a1', url: 'https://cms/a1' })).toThrow(
      /missing required fields/,
    );
    expect(() =>
      normalizeAsset({ url: 'https://cms/a1', createdAt: 'x', updatedAt: 'y' }),
    ).toThrow(/missing required fields/);
  });

  it('throws when response is not an object', () => {
    expect(() => normalizeAsset(null)).toThrow(ReearthApiError);
  });
});

describe('extractSchemaFields', () => {
  it('returns [] when schema is null / undefined / non-object', () => {
    expect(extractSchemaFields(null)).toEqual([]);
    expect(extractSchemaFields(undefined)).toEqual([]);
    expect(extractSchemaFields('x')).toEqual([]);
  });

  it('returns [] when fields is missing or not an array', () => {
    expect(extractSchemaFields({})).toEqual([]);
    expect(extractSchemaFields({ fields: 'nope' })).toEqual([]);
  });

  it('skips malformed entries and keeps valid ones', () => {
    const out = extractSchemaFields({
      fields: [
        { id: 'f1', key: 'title', name: 'Title', type: 'text', required: true, multiple: false },
        null,
        { id: 'f2' }, // missing required strings
        { id: 'f3', key: 'loc', name: 'Location', type: 'geometryObject' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]?.key).toBe('title');
    expect(out[0]?.required).toBe(true);
    expect(out[1]?.key).toBe('loc');
    expect(out[1]?.required).toBe(false);
    expect(out[1]?.multiple).toBe(false);
  });
});
