import { Router } from 'express';
import type { ReearthClient } from '@hw/reearth-api-server';

/**
 * Router for `/api/models` (list) and `/api/models/:idOrKey` (detail).
 *
 * Both endpoints use the Integration API under the hood via the Core
 * (`listModels` / `getModel`).
 */
export function createModelsRouter(client: ReearthClient): Router {
  const router = Router();

  // GET /api/models — list all models (lightweight)
  router.get('/', async (_req, res, next) => {
    try {
      const models = await client.listModels();
      res.json({ models });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/models/:idOrKey — model detail with schema
  router.get('/:idOrKey', async (req, res, next) => {
    try {
      const model = await client.getModel(req.params.idOrKey);
      if (model === null) {
        res.status(404).json({ error: 'Not Found' });
        return;
      }
      res.json(model);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
