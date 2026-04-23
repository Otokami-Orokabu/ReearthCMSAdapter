import express from 'express';
import type { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import { ReearthApiError, type ReearthClient } from '@hw/reearth-api-server';
import { createItemsRouter } from './items.js';
import { createFeaturesRouter } from './features.js';
import { createModelsRouter } from './models.js';

/**
 * Build a ready-to-listen Express {@link Application} that exposes the Core
 * (`createClient` result) over HTTP. Routes:
 *   GET  /api/health
 *   GET  /api/items/:model
 *   GET  /api/items/:model/:id
 *   POST /api/items/:model
 *
 * Error middleware normalizes {@link ReearthApiError} into an HTTP status
 * so downstream clients (web/Unity) never see the raw CMS/SDK error shape.
 */
export function createHttpApp(client: ReearthClient): Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/items', createItemsRouter(client));
  app.use('/api/features', createFeaturesRouter(client));
  app.use('/api/models', createModelsRouter(client));

  // Unified error handler — normalizes ReearthApiError into HTTP responses.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ReearthApiError) {
      const status = err.status ?? 500;
      process.stderr.write(`[http] ${String(status)} ${err.message}\n`);
      res.status(status).json({ error: err.message });
      return;
    }
    process.stderr.write('[http] unexpected error\n');
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}
