import { Router } from 'express';
import { assertCmsPayload, type ReearthClient } from '@hw/reearth-api-server';
import { registerPathParamValidators, withListOpts } from './internal/middleware.js';

/**
 * Router for /api/items.
 *
 *   GET  /:model/all   list draft + published items
 *   GET  /:model       list published items only
 *   GET  /:model/:id   get a single published item
 *   POST /:model       create an item (lands as draft)
 *
 * The static /:model/all route must be declared before the catch-all
 * /:model so Express matches the specific path first.
 */
export function createItemsRouter(client: ReearthClient): Router {
  const router = Router();
  registerPathParamValidators(router);

  router.get(
    '/:model/all',
    withListOpts<{ model: string }>(async (req, res, _next, opts) => {
      const items = await client.listAllItems(req.params.model, opts);
      res.json({ items });
    }),
  );

  router.get(
    '/:model',
    withListOpts<{ model: string }>(async (req, res, _next, opts) => {
      const items = await client.listItems(req.params.model, opts);
      res.json({ items });
    }),
  );

  router.get('/:model/:id', async (req, res, next) => {
    try {
      const { model, id } = req.params;
      const item = await client.getItem(model, id);
      if (item === null) {
        res.status(404).json({ error: 'Item not found' });
        return;
      }
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  router.post('/:model', async (req, res, next) => {
    try {
      const model = req.params.model;
      const body: unknown = req.body;
      try {
        assertCmsPayload(body);
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
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
