import { describe, it, expect } from 'vitest';
import { isCmsPayload } from '../../../src/adapters/http/items.js';

describe('isCmsPayload', () => {
  it('accepts a valid payload with text and integer fields', () => {
    expect(
      isCmsPayload({
        title: { type: 'text', value: 'Hi' },
        count: { type: 'integer', value: 5 },
      }),
    ).toBe(true);
  });

  it('accepts an empty object vacuously', () => {
    expect(isCmsPayload({})).toBe(true);
  });

  it('rejects null', () => {
    expect(isCmsPayload(null)).toBe(false);
  });

  it('rejects arrays', () => {
    expect(isCmsPayload([])).toBe(false);
    expect(isCmsPayload([{ type: 'text', value: 'x' }])).toBe(false);
  });

  it('rejects primitive top-level', () => {
    expect(isCmsPayload('string')).toBe(false);
    expect(isCmsPayload(42)).toBe(false);
    expect(isCmsPayload(true)).toBe(false);
    expect(isCmsPayload(undefined)).toBe(false);
  });

  it('rejects entries missing "type"', () => {
    expect(
      isCmsPayload({
        title: { value: 'Hi' },
      }),
    ).toBe(false);
  });

  it('rejects entries missing "value"', () => {
    expect(
      isCmsPayload({
        title: { type: 'text' },
      }),
    ).toBe(false);
  });

  it('rejects unknown CmsFieldType values', () => {
    expect(
      isCmsPayload({
        title: { type: 'badtype', value: 'Hi' },
      }),
    ).toBe(false);
  });

  it('rejects non-object entry values', () => {
    expect(isCmsPayload({ title: 'plain string' })).toBe(false);
    expect(isCmsPayload({ title: null })).toBe(false);
    expect(isCmsPayload({ title: 42 })).toBe(false);
  });

  it('rejects if any single entry is invalid', () => {
    expect(
      isCmsPayload({
        good: { type: 'text', value: 'ok' },
        bad: { type: 'nope', value: 'x' },
      }),
    ).toBe(false);
  });

  it('accepts all documented CmsFieldType values', () => {
    const types = [
      'text',
      'textArea',
      'markdown',
      'richText',
      'integer',
      'number',
      'bool',
      'date',
      'url',
      'select',
      'tag',
      'asset',
      'reference',
      'geometryObject',
    ] as const;
    for (const type of types) {
      expect(
        isCmsPayload({ x: { type, value: null } }),
      ).toBe(true);
    }
  });
});
