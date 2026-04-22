import { Router } from 'express';
import type { ReearthClient } from '@hw/reearth-api-server';
import { parseListQuery } from './query.js';

/**
 * Router for `/api/features/:model` — fetches items as GeoJSON
 * FeatureCollection via the Core's `listFeatures` (which in turn hits the
 * `.geojson` variant of the Re:Earth CMS Public API).
 *
 * Supports the same client-side filter / sort / offset / limit semantics
 * as `/api/items/:model` through query parameters.
 */
export function createFeaturesRouter(client: ReearthClient): Router {
  const router = Router();

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
      const fc = await client.listFeatures(model, opts);
      res.type('application/geo+json').json(fc);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
