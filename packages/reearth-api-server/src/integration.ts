import { CMS, CMSError } from '@reearth/cms-api';
import type {
  CmsItem,
  ClientConfig,
  CmsPayload,
  CmsModel,
  CmsModelDetail,
  CmsFieldSchema,
} from './types.js';
import { toCmsFields } from './mappers.js';
import { ReearthApiError } from './errors.js';

/**
 * Build a {@link CMS} (Integration) client from the given {@link ClientConfig}.
 * Internal helper to keep SDK construction DRY and consistent.
 */
function makeIntegrationClient(config: ClientConfig): CMS {
  return new CMS({
    baseURL: config.baseUrl,
    token: config.integrationToken,
    workspace: config.workspace,
    project: config.project,
  });
}

/**
 * List all models in the configured project via the Integration API.
 *
 * Maps the SDK's `Model` shape down to our minimal {@link CmsModel} — we
 * intentionally expose only id/key/name/description, not the full schema.
 *
 * @internal — called by {@link createClient} only.
 */
export async function listModelsIntegration(config: ClientConfig): Promise<CmsModel[]> {
  const cms = makeIntegrationClient(config);
  try {
    const response = await cms.getAllModels();
    const out: CmsModel[] = [];
    for (const m of response.results) {
      if (typeof m.id !== 'string' || typeof m.key !== 'string' || typeof m.name !== 'string') {
        continue;
      }
      const model: CmsModel = { id: m.id, key: m.key, name: m.name };
      if (typeof m.description === 'string' && m.description.length > 0) {
        model.description = m.description;
      }
      out.push(model);
    }
    return out;
  } catch (cause) {
    throw wrapIntegrationError('listModelsIntegration failed', cause);
  }
}

/**
 * Get a single model with its schema via the Integration API.
 *
 * Maps the SDK's nested `Model.schema.fields[]` shape down to our
 * {@link CmsModelDetail} with a flat `fields` array, dropping metadata
 * like `schemaId` / `createdAt` that consumers rarely need.
 *
 * @returns the model detail, or `null` if the model does not exist.
 *
 * @internal — called by {@link createClient} only.
 */
export async function getModelIntegration(
  config: ClientConfig,
  modelIdOrKey: string,
): Promise<CmsModelDetail | null> {
  const cms = makeIntegrationClient(config);
  try {
    const raw = await cms.getModel({ modelIdOrKey });
    if (
      typeof raw.id !== 'string' ||
      typeof raw.key !== 'string' ||
      typeof raw.name !== 'string'
    ) {
      return null;
    }
    const detail: CmsModelDetail = {
      id: raw.id,
      key: raw.key,
      name: raw.name,
      fields: extractSchemaFields(raw.schema),
    };
    if (typeof raw.description === 'string' && raw.description.length > 0) {
      detail.description = raw.description;
    }
    const titleField = raw.schema?.titleField;
    if (typeof titleField === 'string' && titleField.length > 0) {
      detail.titleField = titleField;
    }
    return detail;
  } catch (cause) {
    if (cause instanceof CMSError && cause.status === 404) return null;
    throw wrapIntegrationError('getModelIntegration failed', cause);
  }
}

/**
 * Narrow the SDK's optional schema.fields[] into {@link CmsFieldSchema}[].
 * Fields missing required string members are silently skipped.
 */
function extractSchemaFields(schema: unknown): CmsFieldSchema[] {
  if (typeof schema !== 'object' || schema === null) return [];
  const fields = (schema as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const out: CmsFieldSchema[] = [];
  for (const raw of fields) {
    if (typeof raw !== 'object' || raw === null) continue;
    const f = raw as {
      id?: unknown;
      key?: unknown;
      name?: unknown;
      type?: unknown;
      required?: unknown;
      multiple?: unknown;
    };
    if (
      typeof f.id !== 'string' ||
      typeof f.key !== 'string' ||
      typeof f.name !== 'string' ||
      typeof f.type !== 'string'
    ) {
      continue;
    }
    out.push({
      id: f.id,
      key: f.key,
      name: f.name,
      type: f.type,
      required: f.required === true,
      multiple: f.multiple === true,
    });
  }
  return out;
}

/**
 * Create a new item via the Re:Earth CMS **Integration API**.
 *
 * Returns the raw {@link CmsItem} shape (fields as `[{key,type,value}]`).
 * The higher-level {@link ReearthClient.createItem} flattens this via
 * `flattenFields` before returning to callers.
 *
 * **Behaviour to know:**
 * - Created items are **draft** by default. They are NOT visible via the
 *   Public API (`listItemsPublic`) until explicitly published. A dedicated
 *   publish endpoint is required for public visibility (not implemented in
 *   this ACL yet).
 * - `select` / `tag` fields require the `value` to match a CMS-defined
 *   option exactly. Unknown values cause the CMS to return HTTP 400
 *   (propagated as {@link ReearthApiError} with `status = 400`).
 *
 * @internal — called by {@link createClient} only.
 */
export async function createItemIntegration(
  config: ClientConfig,
  model: string,
  payload: CmsPayload,
): Promise<CmsItem> {
  const cms = makeIntegrationClient(config);
  try {
    const item = await cms.createItem({
      model,
      fields: toCmsFields(payload),
    });
    return item as CmsItem;
  } catch (cause) {
    throw wrapIntegrationError('createItemIntegration failed', cause);
  }
}

/**
 * Update an existing item via the Re:Earth CMS **Integration API**.
 *
 * @internal — called by {@link createClient} only.
 */
export async function updateItemIntegration(
  config: ClientConfig,
  itemId: string,
  payload: CmsPayload,
): Promise<CmsItem> {
  const cms = makeIntegrationClient(config);
  try {
    const item = await cms.updateItem({
      itemId,
      fields: toCmsFields(payload),
    });
    return item as CmsItem;
  } catch (cause) {
    throw wrapIntegrationError('updateItemIntegration failed', cause);
  }
}

/**
 * Delete an item via the Re:Earth CMS **Integration API**.
 *
 * @internal — called by {@link createClient} only.
 */
export async function deleteItemIntegration(
  config: ClientConfig,
  itemId: string,
): Promise<void> {
  const cms = makeIntegrationClient(config);
  try {
    await cms.deleteItem({ itemId });
  } catch (cause) {
    throw wrapIntegrationError('deleteItemIntegration failed', cause);
  }
}

/**
 * Publish a draft item via the Re:Earth CMS **Integration API**.
 *
 * Official `@reearth/cms-api` SDK (v0.2.0) does not expose a dedicated
 * publish method, so we call the REST endpoint directly:
 *   `POST /api/{workspace}/projects/{project}/models/{model}/items/{itemId}/publish`
 *
 * Empty request body; success is signalled by HTTP 200-series.
 *
 * @internal — called by {@link createClient} only.
 */
export async function publishItemIntegration(
  config: ClientConfig,
  model: string,
  itemId: string,
): Promise<void> {
  const base = config.baseUrl.replace(/\/+$/, '');
  const url =
    `${base}/api` +
    `/${encodeURIComponent(config.workspace)}` +
    `/projects/${encodeURIComponent(config.project)}` +
    `/models/${encodeURIComponent(model)}` +
    `/items/${encodeURIComponent(itemId)}` +
    `/publish`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.integrationToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ReearthApiError(
      `publishItemIntegration failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ''}`,
      { status: res.status },
    );
  }
}

function wrapIntegrationError(message: string, cause: unknown): ReearthApiError {
  if (cause instanceof CMSError) {
    return new ReearthApiError(`${message}: ${cause.message}`, {
      cause,
      status: cause.status,
    });
  }
  return new ReearthApiError(message, { cause });
}
