import { CMSError } from '@reearth/cms-api';
import type {
  ClientConfig,
  CmsModel,
  CmsModelDetail,
  CmsFieldSchema,
  CmsJsonSchema,
} from '../types.js';
import {
  INTEGRATION_NOT_FOUND,
  makeIntegrationClient,
  sendIntegrationGET,
  wrapIntegrationError,
} from './internal/shared.js';
import { extractSchemaFields, mergeJsonSchemaIntoFields } from './internal/schemaParse.js';
import { isObject } from '../internal/typeGuards.js';

/**
 * List all models in the configured project. Returns a lightweight shape
 * per model (id, key, name, optional description); use
 * getModelIntegration for schema details.
 *
 * @internal
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
 * Get a single model with its schema. Merges the lightweight schema
 * returned by /models/{id} with the richer JSON Schema variant when
 * available (for descriptions, select/tag options, geometry types).
 *
 * @returns the model detail, or null if the model does not exist.
 *
 * @internal
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
    const fields = extractSchemaFields(raw.schema);
    // Re-use the resolved id for the rich fetch to avoid a second
    // key->id round trip inside fetchJsonSchemaById.
    await enrichFieldsFromJsonSchema(config, raw.id, fields);
    const detail: CmsModelDetail = {
      id: raw.id,
      key: raw.key,
      name: raw.name,
      fields,
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
 * Fetch the raw JSON Schema for a model. The underlying endpoint only
 * accepts model ids, so `modelIdOrKey` is resolved via the SDK first.
 *
 * @returns the schema, or null when the model does not exist.
 *
 * @internal
 */
export async function getJsonSchemaIntegration(
  config: ClientConfig,
  modelIdOrKey: string,
): Promise<CmsJsonSchema | null> {
  const cms = makeIntegrationClient(config);
  try {
    const raw = await cms.getModel({ modelIdOrKey });
    if (typeof raw.id !== 'string') return null;
    return await fetchJsonSchemaById(config, raw.id);
  } catch (cause) {
    if (cause instanceof CMSError && cause.status === 404) return null;
    throw wrapIntegrationError('getJsonSchemaIntegration failed', cause);
  }
}

/** Id-only variant of getJsonSchemaIntegration. Used internally to avoid
 *  a redundant getModel round trip when the id is already known. */
async function fetchJsonSchemaById(
  config: ClientConfig,
  modelId: string,
): Promise<CmsJsonSchema | null> {
  try {
    const result = await sendIntegrationGET(
      config,
      `/models/${encodeURIComponent(modelId)}/schema.json`,
    );
    if (result === INTEGRATION_NOT_FOUND) return null;
    if (!isObject(result)) return null;
    return result as CmsJsonSchema;
  } catch (cause) {
    throw wrapIntegrationError('getJsonSchemaIntegration failed', cause);
  }
}

/** Best-effort: fetch the JSON Schema variant and merge its metadata
 *  onto the already-populated fields. Any failure is swallowed so the
 *  caller still gets a useful result. */
async function enrichFieldsFromJsonSchema(
  config: ClientConfig,
  modelId: string,
  fields: CmsFieldSchema[],
): Promise<void> {
  let schema: CmsJsonSchema | null;
  try {
    schema = await fetchJsonSchemaById(config, modelId);
  } catch {
    return;
  }
  if (schema === null) return;
  mergeJsonSchemaIntoFields(schema, fields);
}
