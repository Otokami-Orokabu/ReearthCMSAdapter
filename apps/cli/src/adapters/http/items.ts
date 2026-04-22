import { Router } from 'express';
import {
  CMS_FIELD_TYPE_VALUES,
  type ReearthClient,
  type CmsPayload,
  type CmsFieldType,
} from '@hw/reearth-api-server';
import { parseListQuery } from './query.js';

/**
 * Runtime-checkable Set of {@link CmsFieldType} values.
 * Derived from the SoT {@link CMS_FIELD_TYPE_VALUES} exported by the library.
 */
const CMS_FIELD_TYPES: ReadonlySet<CmsFieldType> = new Set(CMS_FIELD_TYPE_VALUES);

/**
 * Runtime check for {@link CmsPayload}. Validates:
 *  - top-level is a plain object (not array / null)
 *  - every value is `{ type: CmsFieldType, value: <any> }` shape
 *
 * Exported for unit tests; also used by the POST handler.
 */
export function isCmsPayload(body: unknown): body is CmsPayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  for (const entry of Object.values(body)) {
    if (typeof entry !== 'object' || entry === null) return false;
    if (!('type' in entry) || !('value' in entry)) return false;
    const t: unknown = (entry as { type: unknown }).type;
    if (typeof t !== 'string' || !CMS_FIELD_TYPES.has(t as CmsFieldType)) return false;
  }
  return true;
}

/**
 * Build an Express router for the `/api/items` namespace.
 *
 * Routes (mounted under `/api/items`):
 *   GET    /:model         → list items via Public API
 *   GET    /:model/:id     → get single item via Public API
 *   POST   /:model         → create item via Integration API
 *
 * The handler does not flatten or transform items — the underlying
 * {@link ReearthClient} already returns flat domain-shaped objects.
 */
export function createItemsRouter(client: ReearthClient): Router {
  const router = Router();

  // GET /api/items/:model — list (supports ?limit=, ?offset=, ?bbox=, ?sort=)
  router.get('/:model', async (req, res, next) => {
    try {
      const model = req.params.model;
      let opts;
      try {
        opts = parseListQuery(req.query);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
        return;
      }
      const items = await client.listItems(model, opts);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/items/:model/:id — single
  router.get('/:model/:id', async (req, res, next) => {
    try {
      const { model, id } = req.params;
      const item = await client.getItem(model, id);
      if (item === null) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/items/:model — create (requires CmsPayload body)
  router.post('/:model', async (req, res, next) => {
    try {
      const model = req.params.model;
      const body: unknown = req.body;
      if (!isCmsPayload(body)) {
        res.status(400).json({
          error:
            'Invalid payload shape. Expected Record<string, { type: CmsFieldType; value: unknown }>.',
        });
        return;
      }
      const created = await client.createItem(model, body);
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
