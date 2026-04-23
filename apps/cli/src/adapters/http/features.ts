import { Router } from 'express';
import type { ReearthClient } from '@hw/reearth-api-server';
import { registerPathParamValidators, withListOpts } from './internal/middleware.js';

/**
 * Router for /api/features.
 *
 *   GET /:model/bbox   bounding box of all Point-located items
 *   GET /:model        FeatureCollection (shares query options with
 *                      /api/items/:model)
 */
export function createFeaturesRouter(client: ReearthClient): Router {
  const router = Router();
  registerPathParamValidators(router);

  router.get('/:model/bbox', async (req, res, next) => {
    try {
      const bbox = await client.getBounds(req.params.model);
      if (bbox === null) {
        res.status(404).json({ error: 'No Point-located items in this model' });
        return;
      }
      res.json({ bbox });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/:model',
    withListOpts<{ model: string }>(async (req, res, _next, opts) => {
      const fc = await client.listFeatures(req.params.model, opts);
      res.type('application/geo+json').json(fc);
    }),
  );

  return router;
}
