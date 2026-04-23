import { describe, it, expect, vi, beforeEach } from 'vitest';
import multer from 'multer';
import { ReearthApiError } from '@hw/reearth-api-server';
import type { NextFunction, Request, Response } from 'express';
import { httpErrorHandler } from '../../../src/adapters/http/app.js';

interface MockRes {
  status(code: number): MockRes;
  json(obj: unknown): MockRes;
}

/** Minimal Express `Response` stand-in that records `status()` / `json()`. */
function makeRes(): {
  res: Response;
  get statusCode(): number;
  get body(): unknown;
} {
  let statusCode = 0;
  let body: unknown = null;
  const res: MockRes = {
    status(code: number): MockRes {
      statusCode = code;
      return res;
    },
    json(obj: unknown): MockRes {
      body = obj;
      return res;
    },
  };
  return {
    res: res as unknown as Response,
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
}

const req = {} as Request;
const next = (() => undefined) as NextFunction;

beforeEach(() => {
  // Silence stderr noise from the handler during tests.
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('httpErrorHandler — multer normalization', () => {
  it('maps LIMIT_FILE_SIZE to 413 with code in the body', () => {
    const { res, statusCode, body } = (() => {
      const m = makeRes();
      httpErrorHandler(new multer.MulterError('LIMIT_FILE_SIZE'), req, m.res, next);
      return { res: m.res, statusCode: m.statusCode, body: m.body };
    })();
    void res;
    expect(statusCode).toBe(413);
    expect(body).toMatchObject({ code: 'LIMIT_FILE_SIZE' });
    expect((body as { error: string }).error.length).toBeGreaterThan(0);
  });

  it('maps other MulterError codes to 400 (regression — no 500 leak)', () => {
    const otherCodes = [
      'LIMIT_FILE_COUNT',
      'LIMIT_PART_COUNT',
      'LIMIT_FIELD_KEY',
      'LIMIT_FIELD_VALUE',
      'LIMIT_FIELD_COUNT',
      'LIMIT_UNEXPECTED_FILE',
    ] as const;
    for (const code of otherCodes) {
      const m = makeRes();
      httpErrorHandler(new multer.MulterError(code), req, m.res, next);
      expect(m.statusCode, `code=${code}`).toBe(400);
      expect(m.body).toMatchObject({ code });
    }
  });
});

describe('httpErrorHandler — body-parser entity errors', () => {
  // body-parser throws plain `Error`s decorated with `.type` / `.status`,
  // not a distinct subclass — we simulate that shape here.
  function makeBodyParserError(type: string, status: number, message: string): Error {
    const err = new Error(message) as Error & { type: string; status: number };
    err.type = type;
    err.status = status;
    return err;
  }

  it('maps entity.too.large (413) to 413 instead of 500 (regression)', () => {
    const m = makeRes();
    httpErrorHandler(
      makeBodyParserError('entity.too.large', 413, 'request entity too large'),
      req,
      m.res,
      next,
    );
    expect(m.statusCode).toBe(413);
    expect(m.body).toMatchObject({ code: 'entity.too.large' });
  });

  it('maps entity.parse.failed (400) to 400', () => {
    const m = makeRes();
    httpErrorHandler(
      makeBodyParserError('entity.parse.failed', 400, 'invalid json'),
      req,
      m.res,
      next,
    );
    expect(m.statusCode).toBe(400);
    expect(m.body).toMatchObject({ code: 'entity.parse.failed' });
  });

  it('falls back to 400 when status is missing', () => {
    const err = new Error('weird') as Error & { type: string };
    err.type = 'entity.something';
    const m = makeRes();
    httpErrorHandler(err, req, m.res, next);
    expect(m.statusCode).toBe(400);
    expect(m.body).toMatchObject({ code: 'entity.something' });
  });

  it('does NOT misclassify generic Errors with a non-entity type', () => {
    const err = new Error('custom') as Error & { type: string };
    err.type = 'custom.thing';
    const m = makeRes();
    httpErrorHandler(err, req, m.res, next);
    expect(m.statusCode).toBe(500);
  });
});

describe('httpErrorHandler — ReearthApiError', () => {
  it('uses the error.status when set', () => {
    const m = makeRes();
    httpErrorHandler(new ReearthApiError('oops', { status: 404 }), req, m.res, next);
    expect(m.statusCode).toBe(404);
    expect(m.body).toEqual({ error: 'oops' });
  });

  it('falls back to 500 when status is undefined', () => {
    const m = makeRes();
    httpErrorHandler(new ReearthApiError('upstream explosion'), req, m.res, next);
    expect(m.statusCode).toBe(500);
    expect(m.body).toEqual({ error: 'upstream explosion' });
  });
});

describe('httpErrorHandler — fallback', () => {
  it('returns 500 and a generic message for unknown error shapes', () => {
    const m = makeRes();
    httpErrorHandler(new Error('out of the blue'), req, m.res, next);
    expect(m.statusCode).toBe(500);
    expect(m.body).toEqual({ error: 'Internal Server Error' });
  });

  it('handles non-Error throws too', () => {
    const m = makeRes();
    httpErrorHandler('raw string throw', req, m.res, next);
    expect(m.statusCode).toBe(500);
    expect(m.body).toEqual({ error: 'Internal Server Error' });
  });
});
