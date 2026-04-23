import type { CmsPayload } from './fields.js';
import type { CmsModel, CmsModelDetail, CmsJsonSchema } from './models.js';
import type { CmsAsset } from './assets.js';
import type { Bbox, GeoJSONFeatureCollection } from './geo.js';
import type { ListOpts } from './list.js';

/** Configuration for a client instance; supplied once at createClient
 *  time and captured in a closure. This package never reads process.env. */
export interface ClientConfig {
  /**
   * Base URL of the CMS API server. Shared between the Public API (read)
   * and the Integration API (write).
   *
   * @example "https://api.cms.reearth.io"
   */
  baseUrl: string;
  /** Workspace identifier. Accepts either UUID or alias. */
  workspace: string;
  /** Project identifier. Accepts either UUID or alias. */
  project: string;
  /** Bearer token for the Integration API (write side). Public API reads
   *  go out unauthenticated. */
  integrationToken: string;
}

/**
 * Primary Port of the hexagonal architecture. Consumers depend on this
 * interface, never on the underlying CMS SDK. The generic T on item
 * methods lets each caller pick its own domain shape.
 */
export interface ReearthClient {
  /** List every model in the configured project. */
  listModels(): Promise<CmsModel[]>;

  /**
   * Get a single model with its schema. Merges the lightweight and rich
   * schema endpoints; if the rich fetch fails the lightweight result is
   * still returned.
   *
   * @returns the model detail, or null when it does not exist.
   */
  getModel(modelIdOrKey: string): Promise<CmsModelDetail | null>;

  /**
   * Get the raw JSON Schema for a model. Prefer getModel for routine
   * field discovery; use this only when the untouched schema is needed.
   *
   * @returns the schema object, or null when the model does not exist.
   */
  getJsonSchema(modelIdOrKey: string): Promise<CmsJsonSchema | null>;

  /**
   * List items for a model using the Public API (published items only).
   */
  listItems<T>(model: string, opts?: ListOpts): Promise<T[]>;

  /**
   * List items for a model using the Integration API (draft and
   * published). Same filter / sort / pagination semantics as listItems.
   */
  listAllItems<T>(model: string, opts?: ListOpts): Promise<T[]>;

  /**
   * Fetch items as a GeoJSON FeatureCollection. Items without a valid
   * Point location are excluded server-side; filter / sort / pagination
   * apply client-side after fetch.
   */
  listFeatures(model: string, opts?: ListOpts): Promise<GeoJSONFeatureCollection>;

  /**
   * Compute the smallest bounding box that contains all Point-located
   * items of a model.
   *
   * @returns [minLng, minLat, maxLng, maxLat], or null when the model
   *   has no Point-located items.
   */
  getBounds(model: string): Promise<Bbox | null>;

  /**
   * Get a single item by id using the Public API (published only).
   *
   * @returns the item, or null when it does not exist or is a draft.
   */
  getItem<T>(model: string, id: string): Promise<T | null>;

  /**
   * Create a new item using the Integration API. The item lands as a
   * draft and requires publishItem to appear via the Public API.
   */
  createItem<T>(model: string, payload: CmsPayload): Promise<T>;

  /** Update an existing item using the Integration API. The publish
   *  state is preserved. */
  updateItem<T>(itemId: string, payload: CmsPayload): Promise<T>;

  /** Delete an item using the Integration API. */
  deleteItem(itemId: string): Promise<void>;

  /** Publish a draft item so it becomes visible via the Public API. */
  publishItem(model: string, itemId: string): Promise<void>;

  /**
   * Get a single asset by id.
   *
   * @returns the asset, or null when it does not exist.
   */
  getAsset(assetId: string): Promise<CmsAsset | null>;

  /** Upload an asset by asking the CMS to fetch a publicly reachable URL.
   *  The URL is SSRF-checked before it is sent. */
  uploadAssetByURL(url: string): Promise<CmsAsset>;

  /** Upload an asset by sending the file bytes directly (multipart). */
  uploadAssetFile(options: {
    data: Uint8Array;
    name: string;
    contentType?: string;
  }): Promise<CmsAsset>;
}
