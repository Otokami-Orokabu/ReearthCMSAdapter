/**
 * Configuration for a Re:Earth CMS client instance.
 *
 * Supplied once at {@link createClient} time and captured in a closure so
 * individual method calls stay ergonomic. `process.env` is NEVER read inside
 * this package — the caller (typically `apps/server`) is the SoT for env.
 */
export interface ClientConfig {
  /**
   * Base URL of the Re:Earth CMS API server. Used by BOTH the Public API
   * (read) and the Integration API (write) — they share the host but differ
   * in path.
   *
   * @example "https://api.cms.reearth.io"
   */
  baseUrl: string;
  /**
   * Workspace identifier — ID (UUID) or alias. The SDK accepts either form.
   * Used by Integration API paths: `/api/workspaces/{workspace}/...`
   */
  workspace: string;
  /**
   * Project identifier — ID (UUID) or alias. The SDK accepts either form.
   * Used by BOTH APIs:
   * - Public API path: `/api/p/{project}/...`
   * - Integration API path: `/api/workspaces/.../projects/{project}/...`
   */
  project: string;
  /**
   * Optional Bearer token for Public API.
   * Only required when the project publication is scoped as "private".
   * For public projects this can be omitted.
   */
  publicToken?: string;
  /**
   * Bearer token for Integration API (write side).
   * Required for {@link ReearthClient.createItem}, `updateItem`, `deleteItem`,
   * and Asset uploads.
   */
  integrationToken: string;
}

/**
 * All CMS field types supported by Re:Earth CMS.
 * Each {@link CmsField} on a {@link CmsItem} has exactly one of these as its `type`.
 *
 * **Note — `select` / `tag` type caveat**: when writing a `select` or `tag`
 * field, the `value` string must match one of the option strings
 * pre-registered on the CMS model. Sending an unknown value returns HTTP
 * 400. For bulk seeding, either omit these fields or pass the exact options
 * defined in the CMS UI.
 *
 * Source: `kobe-map-server/server.js:382-446` `convertFieldsToApiFormat`.
 */
/**
 * Runtime list of all {@link CmsFieldType} values.
 *
 * Serves as the SoT for runtime validation (`isCmsPayload` in apps/server).
 * When adding a new type, update here only — the TS type below derives from
 * this array via `typeof CMS_FIELD_TYPE_VALUES[number]`.
 */
export const CMS_FIELD_TYPE_VALUES = [
  'text',
  'textArea',
  'markdown',
  'richText',
  'integer',
  'number',
  'bool',
  'date',
  'url',
  'select',
  'tag',
  'asset',
  'reference',
  'geometryObject',
] as const satisfies readonly string[];

export type CmsFieldType = (typeof CMS_FIELD_TYPE_VALUES)[number];

/**
 * A single field on a {@link CmsItem}. Items hold an ORDERED array of these.
 * Within one item, the same `key` is never repeated.
 */
export interface CmsField {
  /** Stable key defined in the CMS schema (e.g. `"title"`, `"location"`). */
  key: string;
  /** Field type; drives serialization/validation on the CMS side. */
  type: CmsFieldType;
  /** Raw value. Shape depends on `type` (string, number, GeoJSON geometry, asset id array, ...). */
  value: unknown;
}

/**
 * A single item (row) as represented by the CMS.
 *
 * This is the RAW DTO exposed by the external SDK. Downstream code should use
 * {@link flattenFields} to convert it into a flat domain-shaped object.
 */
export interface CmsItem {
  /** CMS-assigned item ID. */
  id: string;
  /** ISO-8601 timestamp of creation, if the CMS returns it. */
  createdAt?: string;
  /** ISO-8601 timestamp of last update, if the CMS returns it. */
  updatedAt?: string;
  /** Primary content fields. Always present (may be empty array). */
  fields: CmsField[];
  /** Metadata fields, if defined on the model. */
  metadataFields?: CmsField[];
  /** Items referenced via `reference` fields, inlined by the CMS if requested. */
  referencedItems?: CmsItem[];
}

/**
 * Ergonomic input shape for create/update operations.
 *
 * The caller supplies each field as `{ type, value }` because the CMS requires
 * an explicit `type` on the wire, and the ACL refuses to guess from JS values
 * (a JS `number` could be `integer`, `number`, or even `select` depending on
 * the model). The ACL converts this dict into the CMS fields array via
 * {@link toCmsFields} internally.
 *
 * @example
 * const payload: CmsPayload = {
 *   title: { type: 'text', value: 'Hello' },
 *   location: { type: 'geometryObject', value: makePointGeometry(139, 35) },
 * };
 */
export type CmsPayload = Record<string, { type: CmsFieldType; value: unknown }>;

/**
 * Bounding box as `[minLng, minLat, maxLng, maxLat]` in WGS-84 degrees.
 * Matches the conventional MapLibre / Leaflet bbox tuple order.
 */
export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number];

/**
 * Sort specification applied client-side after fetch.
 */
export interface SortSpec {
  /** Field name to sort by (top-level property on items, or property on Feature). */
  field: string;
  /** Sort direction, defaults to `'asc'`. */
  order?: 'asc' | 'desc';
}

/**
 * Options for list operations.
 *
 * **Where the work happens:**
 *
 * The Re:Earth CMS Public API does NOT support server-side filtering or
 * sorting (only a `per_page` hint). All filtering/sorting/slicing in this
 * library is therefore performed **client-side** on the fetched payload.
 * This is fine at small/medium scale but scales poorly past ~thousands of
 * items; for larger datasets a dedicated index would be needed.
 *
 * Execution order: bbox filter → sort → offset → limit.
 */
export interface ListOpts {
  /** Maximum number of items to return after filtering/sorting. */
  limit?: number;
  /** Offset applied after filtering/sorting (zero-based). */
  offset?: number;
  /** Keep only items whose `location` is a Point inside the bbox. */
  bbox?: Bbox;
  /** Sort result by a field (client-side). */
  sort?: SortSpec;
}

/** Minimal GeoJSON Point as used on the Re:Earth CMS wire. */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: readonly [number, number];
}

/**
 * Minimal GeoJSON Feature. Re:Earth CMS emits only Point geometries for now,
 * so we type the geometry narrowly; broaden when other types appear.
 */
export interface GeoJSONFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string;
  geometry: GeoJSONPoint | null;
  properties: P | null;
}

/**
 * FeatureCollection as returned by the `*.geojson` variant of the Public API
 * (e.g. `/api/p/{ws}/{p}/{model}.geojson`).
 */
export interface GeoJSONFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: GeoJSONFeature<P>[];
}

/**
 * Primary Port of the Hexagonal architecture.
 *
 * Consumers (`apps/server`, CLI, batch scripts, tests) depend on this
 * interface, never on the underlying CMS SDK. The generic `<T>` lets each
 * caller decide its own domain type (e.g. `Post`, `Report`).
 *
 * Use {@link flattenFields} to get the default flat representation from a
 * {@link CmsItem}.
 */
/**
 * Minimal CMS Model shape exposed by this ACL — raw SDK fields are narrowed
 * to the subset needed by consumers.
 *
 * **Where to find the ID in the UI**: the Re:Earth CMS management URL of
 * the form `/workspace/<ws>/project/<p>/schema/<id>` contains the Model ID
 * as the trailing UUID. The CLI's `reearth-cms models` also prints
 * id / key / name for every model in the project.
 */
export interface CmsModel {
  /** Model UUID (used by Integration API paths). */
  id: string;
  /** Human-readable key (used by Public API paths). */
  key: string;
  /** Display name as shown in the CMS UI. */
  name: string;
  /** Optional description authored in the CMS. */
  description?: string;
}

export interface ReearthClient {
  /**
   * List all models in the configured project via the Integration API.
   */
  listModels(): Promise<CmsModel[]>;

  /**
   * List items for a model using the Public API.
   *
   * @param model - CMS model identifier (ID or key; SDK accepts either).
   * @param opts - Optional filter / sort / pagination opts.
   */
  listItems<T>(model: string, opts?: ListOpts): Promise<T[]>;

  /**
   * Fetch items as a GeoJSON FeatureCollection via the `.geojson` variant of
   * the Public API. Items without a valid Point location are excluded
   * server-side by the CMS.
   *
   * Filter / sort / pagination apply client-side after fetch, using
   * `feature.geometry` (for bbox) and `feature.properties[field]` (for sort).
   */
  listFeatures(model: string, opts?: ListOpts): Promise<GeoJSONFeatureCollection>;

  /**
   * Get a single item by ID using the Public API.
   *
   * @returns The item, or `null` if it does not exist.
   */
  getItem<T>(model: string, id: string): Promise<T | null>;

  /**
   * Create a new item using the Integration API.
   *
   * @param model - CMS model identifier (ID or key; SDK accepts either).
   * @param payload - Fields to set, shaped as {@link CmsPayload}.
   */
  createItem<T>(model: string, payload: CmsPayload): Promise<T>;

  /**
   * Update an existing item using the Integration API.
   *
   * @param itemId - CMS item ID to update.
   * @param payload - Partial fields to change, shaped as {@link CmsPayload}.
   */
  updateItem<T>(itemId: string, payload: CmsPayload): Promise<T>;

  /**
   * Delete an item using the Integration API.
   */
  deleteItem(itemId: string): Promise<void>;

  /**
   * Publish a draft item so it becomes visible via the Public API.
   *
   * Integration-API-created items are draft by default; they do NOT appear
   * in {@link ReearthClient.listItems} until published.
   */
  publishItem(model: string, itemId: string): Promise<void>;
}
