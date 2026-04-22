import { describe, it, expect } from 'vitest';
import { ReearthApiError } from '../src/errors.js';

describe('ReearthApiError', () => {
  it('has name "ReearthApiError"', () => {
    expect(new ReearthApiError('msg').name).toBe('ReearthApiError');
  });

  it('preserves the message', () => {
    expect(new ReearthApiError('my error').message).toBe('my error');
  });

  it('is instanceof Error', () => {
    expect(new ReearthApiError('x')).toBeInstanceOf(Error);
  });

  it('records status when provided', () => {
    const err = new ReearthApiError('x', { status: 404 });
    expect(err.status).toBe(404);
  });

  it('leaves status undefined when not provided', () => {
    expect(new ReearthApiError('x').status).toBeUndefined();
  });

  it('preserves cause (native Error.cause)', () => {
    const original = new Error('underlying');
    const err = new ReearthApiError('wrapper', { cause: original });
    expect(err.cause).toBe(original);
  });

  it('preserves cause for non-Error values', () => {
    const err = new ReearthApiError('x', { cause: { code: 42 } });
    expect(err.cause).toEqual({ code: 42 });
  });

  it('can be caught as Error', () => {
    try {
      throw new ReearthApiError('boom', { status: 500 });
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(ReearthApiError);
      if (e instanceof ReearthApiError) expect(e.status).toBe(500);
    }
  });
});
