import type { Request, Response, NextFunction, RequestHandler, Router } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ListOpts } from '@hw/reearth-api-server';
import { parseListQuery } from '../query.js';

/** Upper bound for path-parameter length (chars). CMS ids are ~36 chars
 *  and aliases are short; 128 gives comfortable headroom while still
 *  cutting off abusive values cheaply. */
export const MAX_PATH_PARAM_LEN = 128;

/**
 * Reject empty, non-string, or excessively long path parameters with
 * 400 before the request reaches the route handler. The upper bound is
 * MAX_PATH_PARAM_LEN.
 *
 * Exported for unit tests; in production use registerPathParamValidators.
 */
export function assertPathParamStr(
  _req: Request,
  res: Response,
  next: NextFunction,
  value: unknown,
  name: string,
): void {
  if (typeof value !== 'string' || value.length === 0) {
    res.status(400).json({ error: `path parameter "${name}" is required` });
    return;
  }
  if (value.length > MAX_PATH_PARAM_LEN) {
    res.status(400).json({
      error: `path parameter "${name}" exceeds ${String(MAX_PATH_PARAM_LEN)} chars`,
    });
    return;
  }
  next();
}

/** Install assertPathParamStr for every path-param name used in this
 *  codebase. Names not present in a given route are a no-op, so
 *  registering all of them on every router is cheap. */
export function registerPathParamValidators(router: Router): void {
  for (const name of ['model', 'id', 'idOrKey'] as const) {
    router.param(name, (req, res, next, value) => {
      assertPathParamStr(req, res, next, value, name);
    });
  }
}

/** Handler signature for routes that consume parsed ListOpts. Generic
 *  over the route's param shape so req.params stays narrowed in the
 *  handler body. */
export type ListOptsHandler<P = ParamsDictionary> = (
  req: Request<P>,
  res: Response,
  next: NextFunction,
  opts: ListOpts,
) => Promise<void>;

/**
 * Wrap a route handler so that ListOpts parsing happens uniformly:
 * query-parse errors become 400 with the parser's message, and async
 * rejections are forwarded to next(err) for the app-level error
 * middleware.
 *
 * @example
 * router.get(
 *   '/:model',
 *   withListOpts<{ model: string }>(async (req, res, _next, opts) => {
 *     const items = await client.listItems(req.params.model, opts);
 *     res.json({ items });
 *   }),
 * );
 */
export function withListOpts<P = ParamsDictionary>(
  handler: ListOptsHandler<P>,
): RequestHandler<P> {
  return (req, res, next): void => {
    let opts: ListOpts;
    try {
      opts = parseListQuery(req.query);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
      return;
    }
    handler(req, res, next, opts).catch(next);
  };
}
