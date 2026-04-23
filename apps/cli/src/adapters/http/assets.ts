import { Router } from 'express';
import multer from 'multer';
import type { ReearthClient } from '@hw/reearth-api-server';
import { registerPathParamValidators } from './internal/middleware.js';

/** Default multipart upload size cap (32 MB). Override per-deployment. */
export const DEFAULT_MAX_UPLOAD_BYTES = 32 * 1024 * 1024;

export interface AssetsRouterOptions {
  /** Multipart upload size cap in bytes. Defaults to DEFAULT_MAX_UPLOAD_BYTES. */
  maxUploadBytes?: number;
}

/**
 * Router for /api/assets.
 *
 *   GET  /:id    get a single asset
 *   POST /       JSON body { url: string } (URL upload)
 *   POST /file   multipart/form-data with field "file" (direct upload)
 *
 * The two POST routes are kept separate so each has a well-defined
 * body-parsing mode: / uses the global express.json(), /file opts into
 * multer (memory storage, size-capped).
 */
export function createAssetsRouter(
  client: ReearthClient,
  options?: AssetsRouterOptions,
): Router {
  const router = Router();
  registerPathParamValidators(router);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options?.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES },
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const asset = await client.getAsset(req.params.id);
      if (asset === null) {
        res.status(404).json({ error: 'Asset not found' });
        return;
      }
      res.json(asset);
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const body: unknown = req.body;
      if (typeof body !== 'object' || body === null) {
        res.status(400).json({ error: 'Body must be a JSON object.' });
        return;
      }
      const url = (body as { url?: unknown }).url;
      if (typeof url !== 'string' || url.length === 0) {
        res.status(400).json({ error: 'Body must include a non-empty "url" string.' });
        return;
      }
      const asset = await client.uploadAssetByURL(url);
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  });

  router.post('/file', upload.single('file'), async (req, res, next) => {
    try {
      const file = req.file;
      if (file === undefined) {
        res.status(400).json({ error: 'Multipart field "file" is required.' });
        return;
      }
      const opts: { data: Uint8Array; name: string; contentType?: string } = {
        data: file.buffer,
        name: file.originalname,
      };
      if (file.mimetype.length > 0) opts.contentType = file.mimetype;
      const asset = await client.uploadAssetFile(opts);
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
