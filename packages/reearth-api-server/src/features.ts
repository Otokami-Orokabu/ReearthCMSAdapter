import type {
  ClientConfig,
  ListOpts,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
} from './types.js';
import { ReearthApiError } from './errors.js';
import { sendPublicGET } from './_http.js';
import { filterByBbox, sortBy, slice } from './filter.js';

/**
 * Build the Public API URL for the `.geojson` variant.
 *
 * Re:Earth CMS exposes a GeoJSON FeatureCollection form by appending
 * `.geojson` to the items endpoint path:
 *   `/api/p/{workspace}/{project}/{model}.geojson`
 *
 * Items without a valid Point location are already excluded by the CMS on
 * the server side; the response only contains location-bearing features.
 */
function buildFeaturesUrl(config: ClientConfig, model: string): string {
  const base = config.baseUrl.replace(/\/+$/, '');
  return (
    `${base}/api/p` +
    `/${encodeURIComponent(config.workspace)}` +
    `/${encodeURIComponent(config.project)}` +
    `/${encodeURIComponent(model)}.geojson`
  );
}

/**
 * Fetch items as a GeoJSON FeatureCollection and apply client-side
 * filter / sort / slice.
 *
 * @internal — called by {@link createClient} only.
 */
export async function listFeaturesPublic(
  config: ClientConfig,
  model: string,
  opts?: ListOpts,
): Promise<GeoJSONFeatureCollection> {
  const json = await sendPublicGET(buildFeaturesUrl(config, model), config.publicToken);
  const collection = parseFeatureCollection(json);

  let features: GeoJSONFeature[] = collection.features;
  if (opts?.bbox !== undefined) features = filterByBbox(features, opts.bbox, extractFeatureCoords);
  if (opts?.sort !== undefined) features = sortBy(features, opts.sort, extractFeatureField);
  features = slice(features, {
    ...(opts?.offset !== undefined ? { offset: opts.offset } : {}),
    ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
  });

  return { type: 'FeatureCollection', features };
}

/**
 * Extract `[lng, lat]` from a Feature's `geometry` if it is a Point;
 * otherwise return `null` (excluded from bbox filter).
 */
function extractFeatureCoords(feature: GeoJSONFeature): readonly [number, number] | null {
  const g = feature.geometry;
  if (g === null) return null;
  if (g.type !== 'Point') return null;
  const [lng, lat] = g.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

/**
 * Read a field for sorting purposes:
 * - `id` → `feature.id`
 * - `geometry.*` → (not supported; returns `undefined`)
 * - otherwise → `feature.properties[field]`
 */
function extractFeatureField(feature: GeoJSONFeature, field: string): unknown {
  if (field === 'id') return feature.id;
  const props = feature.properties;
  if (props === null) return undefined;
  return props[field];
}

/**
 * Narrow an unknown JSON body to {@link GeoJSONFeatureCollection}.
 */
function parseFeatureCollection(json: unknown): GeoJSONFeatureCollection {
  if (typeof json !== 'object' || json === null) {
    throw new ReearthApiError('GeoJSON: response is not an object');
  }
  if (!('type' in json) || (json as { type: unknown }).type !== 'FeatureCollection') {
    throw new ReearthApiError('GeoJSON: type is not "FeatureCollection"');
  }
  if (!('features' in json) || !Array.isArray((json as { features: unknown }).features)) {
    throw new ReearthApiError('GeoJSON: features is not an array');
  }
  return json as GeoJSONFeatureCollection;
}
