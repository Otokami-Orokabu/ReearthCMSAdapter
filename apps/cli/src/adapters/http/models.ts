import { Router } from 'express';
import type { ReearthClient } from '@hw/reearth-api-server';
import { registerPathParamValidators } from './internal/middleware.js';

/**
 * Router for /api/models.
 *
 *   GET /                         list all models (lightweight)
 *   GET /:idOrKey                 model detail with merged schema
 *   GET /:idOrKey/schema.json     raw JSON Schema
 *
 * The schema.json variant must be declared before the catch-all
 * /:idOrKey so Express matches it first.
 */
export function createModelsRouter(client: ReearthClient): Router {
  const router = Router();
  registerPathParamValidators(router);

  router.get('/', async (_req, res, next) => {
    try {
      const models = await client.listModels();
      res.json({ models });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:idOrKey/schema.json', async (req, res, next) => {
    try {
      const schema = await client.getJsonSchema(req.params.idOrKey);
      if (schema === null) {
        res.status(404).json({ error: 'Model schema not found' });
        return;
      }
      res.json(schema);
    } catch (err) {
      next(err);
    }
  });

  router.get('/:idOrKey', async (req, res, next) => {
    try {
      const model = await client.getModel(req.params.idOrKey);
      if (model === null) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }
      res.json(model);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
