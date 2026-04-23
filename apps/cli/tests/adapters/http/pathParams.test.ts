import { describe, it, expect } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import {
  assertPathParamStr,
  MAX_PATH_PARAM_LEN,
} from '../../../src/adapters/http/internal/middleware.js';

interface MockRes {
  status(code: number): MockRes;
  json(obj: unknown): MockRes;
}

function makeRes(): { res: Response; get statusCode(): number; get body(): unknown } {
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

/** NextFunction has an overloaded `("route" | "router")` signature that
 *  defeats `vi.fn<NextFunction>()` type inference, so we track invocations
 *  with a plain counter object instead. */
function makeNext(): { next: NextFunction; get called(): number } {
  let called = 0;
  const next: NextFunction = (): void => {
    called++;
  };
  return {
    next,
    get called() {
      return called;
    },
  };
}

describe('assertPathParamStr', () => {
  it('calls next() for normal short strings', () => {
    const n = makeNext();
    const m = makeRes();
    assertPathParamStr(req, m.res, n.next, 'hazzrd_reports', 'model');
    expect(n.called).toBe(1);
    expect(m.statusCode).toBe(0);
  });

  it('calls next() at exactly MAX_PATH_PARAM_LEN chars', () => {
    const n = makeNext();
    const m = makeRes();
    assertPathParamStr(req, m.res, n.next, 'a'.repeat(MAX_PATH_PARAM_LEN), 'id');
    expect(n.called).toBe(1);
  });

  it('rejects empty string with 400', () => {
    const n = makeNext();
    const m = makeRes();
    assertPathParamStr(req, m.res, n.next, '', 'model');
    expect(n.called).toBe(0);
    expect(m.statusCode).toBe(400);
    expect(m.body).toEqual({ error: 'path parameter "model" is required' });
  });

  it('rejects non-string values with 400', () => {
    const n = makeNext();
    const m = makeRes();
    assertPathParamStr(req, m.res, n.next, 42, 'id');
    expect(n.called).toBe(0);
    expect(m.statusCode).toBe(400);
    expect(m.body).toMatchObject({ error: expect.stringContaining('"id"') as string });
  });

  it('rejects over-length strings with 400', () => {
    const n = makeNext();
    const m = makeRes();
    assertPathParamStr(req, m.res, n.next, 'x'.repeat(MAX_PATH_PARAM_LEN + 1), 'idOrKey');
    expect(n.called).toBe(0);
    expect(m.statusCode).toBe(400);
    expect(m.body).toMatchObject({
      error: expect.stringContaining(String(MAX_PATH_PARAM_LEN)) as string,
    });
  });
});
