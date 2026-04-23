import express from 'express';
import type { Request, Response, NextFunction, Application } from 'express';
import cors from 'cors';
import multer from 'multer';
import { ReearthApiError, type ReearthClient } from '@hw/reearth-api-server';
import { createItemsRouter } from './items.js';
import { createFeaturesRouter } from './features.js';
import { createModelsRouter } from './models.js';
import { createAssetsRouter, type AssetsRouterOptions } from './assets.js';

/** Default JSON body cap (1 MB). Override via HttpAppOptions.maxJsonBodyBytes. */
export const DEFAULT_MAX_JSON_BODY_BYTES = 1024 * 1024;

export interface HttpAppOptions {
  /** Multipart upload size cap in bytes; forwarded to the assets router. */
  maxUploadBytes?: number;
  /** JSON body size cap in bytes. Defaults to DEFAULT_MAX_JSON_BODY_BYTES. */
  maxJsonBodyBytes?: number;
}

/**
 * Build a ready-to-listen Express Application. Routers mounted under
 * /api: items, features, models, assets; /api/health is a liveness
 * probe.
 *
 * Error middleware (httpErrorHandler) maps the errors the app knows to
 * HTTP status codes and falls back to 500 for anything unrecognised.
 */
export function createHttpApp(client: ReearthClient, options?: HttpAppOptions): Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: options?.maxJsonBodyBytes ?? DEFAULT_MAX_JSON_BODY_BYTES }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const assetsOptions: AssetsRouterOptions = {};
  if (options?.maxUploadBytes !== undefined) assetsOptions.maxUploadBytes = options.maxUploadBytes;

  app.use('/api/items', createItemsRouter(client));
  app.use('/api/features', createFeaturesRouter(client));
  app.use('/api/models', createModelsRouter(client));
  app.use('/api/assets', createAssetsRouter(client, assetsOptions));

  app.use(httpErrorHandler);

  return app;
}

/**
 * Unified Express error handler. Maps recognised errors to meaningful
 * HTTP status codes (multer size / upload errors, body-parser entity
 * errors, ReearthApiError) and falls back to 500. Exported so tests can
 * drive the mapping directly without standing up a server.
 */
export function httpErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    // LIMIT_FILE_SIZE maps to 413; every other MulterError code is an
    // upstream input error, so 400.
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    process.stderr.write(`[http] ${String(status)} multer ${err.code}: ${err.message}\n`);
    res.status(status).json({ error: err.message, code: err.code });
    return;
  }
  if (isBodyParserError(err)) {
    // body-parser decorates its Errors with type/status; surface as the
    // client error they actually represent (413 / 400 / 415) instead of
    // a generic 500.
    const status = typeof err.status === 'number' ? err.status : 400;
    process.stderr.write(`[http] ${String(status)} body-parser ${err.type}: ${err.message}\n`);
    res.status(status).json({ error: err.message, code: err.type });
    return;
  }
  if (err instanceof ReearthApiError) {
    const status = err.status ?? 500;
    process.stderr.write(`[http] ${String(status)} ${err.message}\n`);
    res.status(status).json({ error: err.message });
    return;
  }
  process.stderr.write('[http] unexpected error\n');
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
}

/** Detect body-parser errors structurally: plain Error objects decorated
 *  with `type: "entity.*"` and optionally `status`. */
function isBodyParserError(
  err: unknown,
): err is Error & { type: string; status?: number; message: string } {
  if (!(err instanceof Error)) return false;
  const type = (err as { type?: unknown }).type;
  return typeof type === 'string' && type.startsWith('entity.');
}
