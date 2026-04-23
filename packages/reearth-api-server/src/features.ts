import type {
  Bbox,
  ClientConfig,
  ListOpts,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  GeoJSONPoint,
} from './types.js';
import { ReearthApiError } from './errors.js';
import { publicBaseUrl, sendPublicGET } from './internal/http.js';
import { applyListOps } from './filter.js';
import { isObject } from './internal/typeGuards.js';

/** Build the Public API .geojson URL for a model. */
function buildFeaturesUrl(config: ClientConfig, model: string): string {
  return `${publicBaseUrl(config)}/${encodeURIComponent(model)}.geojson`;
}

/** Per-request page size for the .geojson walk. */
const PAGE_SIZE = 100;

/** Hard pagination cap, mirrors listItemsPublic. */
const MAX_PAGES = 100;

/**
 * Fetch items as a GeoJSON FeatureCollection and apply client-side
 * filter / sort / slice.
 *
 * The .geojson variant supports per_page and page but does not return a
 * totalCount, and server-side Point filtering can make individual pages
 * shorter than per_page, so the loop terminates only on an empty page.
 *
 * @throws ReearthApiError when the model exceeds MAX_PAGES * PAGE_SIZE
 *   (= 10,000) features; the call refuses to return a truncated result.
 *
 * @internal
 */
export async function listFeaturesPublic(
  config: ClientConfig,
  model: string,
  opts?: ListOpts,
): Promise<GeoJSONFeatureCollection> {
  const features: GeoJSONFeature[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(buildFeaturesUrl(config, model));
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const json = await sendPublicGET(url.toString());
    const parsed = parseFeatureCollection(json);

    if (parsed.features.length === 0) break;
    features.push(...parsed.features);

    if (page === MAX_PAGES) {
      throw new ReearthApiError(
        `listFeaturesPublic: model "${model}" exceeds the pagination guard ` +
          `(${String(MAX_PAGES)} pages x ${String(PAGE_SIZE)} items = ${String(MAX_PAGES * PAGE_SIZE)}); ` +
          `refusing to return a truncated result. Narrow the query or raise MAX_PAGES if this is legitimate.`,
      );
    }
  }

  const out = applyListOps(features, opts, extractFeatureCoords, extractFeatureField);
  return { type: 'FeatureCollection', features: out };
}

/**
 * Compute the axis-aligned bbox covering every Point-located feature in a
 * model.
 *
 * @returns [minLng, minLat, maxLng, maxLat], or null when no Point feature
 *   exists.
 *
 * @internal
 */
export async function getBoundsPublic(
  config: ClientConfig,
  model: string,
): Promise<Bbox | null> {
  const fc = await listFeaturesPublic(config, model);
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let any = false;
  for (const f of fc.features) {
    const c = extractFeatureCoords(f);
    if (c === null) continue;
    any = true;
    const [lng, lat] = c;
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  if (!any) return null;
  return [minLng, minLat, maxLng, maxLat];
}

/** Extract [lng, lat] from a Feature when the geometry is a Point; return
 *  null otherwise so callers can skip it. */
function extractFeatureCoords(feature: GeoJSONFeature): readonly [number, number] | null {
  const g = feature.geometry;
  if (g === null) return null;
  if (g.type !== 'Point') return null;
  const [lng, lat] = g.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return [lng, lat];
}

/** Field accessor used by sortBy: id maps to feature.id, everything else
 *  goes to feature.properties[field]. */
function extractFeatureField(feature: GeoJSONFeature, field: string): unknown {
  if (field === 'id') return feature.id;
  const props = feature.properties;
  if (props === null) return undefined;
  return props[field];
}

/**
 * Runtime shape check for a FeatureCollection. Validates the envelope and
 * each feature; malformed entries are dropped rather than thrown so one
 * bad row doesn't fail the whole query.
 */
function parseFeatureCollection(json: unknown): GeoJSONFeatureCollection {
  if (!isObject(json)) {
    throw new ReearthApiError('GeoJSON: response is not an object');
  }
  if (json.type !== 'FeatureCollection') {
    throw new ReearthApiError('GeoJSON: type is not "FeatureCollection"');
  }
  if (!Array.isArray(json.features)) {
    throw new ReearthApiError('GeoJSON: features is not an array');
  }
  const features: GeoJSONFeature[] = [];
  for (const raw of json.features) {
    const f = narrowFeature(raw);
    if (f !== null) features.push(f);
  }
  return { type: 'FeatureCollection', features };
}

/** Narrow a single raw entry; return null if it doesn't structurally fit. */
function narrowFeature(raw: unknown): GeoJSONFeature | null {
  if (!isObject(raw)) return null;
  if (raw.type !== 'Feature') return null;
  const geometry = narrowPointGeometry(raw.geometry);
  const properties = isObject(raw.properties) ? raw.properties : null;
  const feature: GeoJSONFeature = {
    type: 'Feature',
    geometry,
    properties,
  };
  if (typeof raw.id === 'string') feature.id = raw.id;
  return feature;
}

/** Narrow to a GeoJSONPoint or null. Non-Point geometries and malformed
 *  coordinates both collapse to null so downstream code treats them
 *  uniformly as "no location". */
function narrowPointGeometry(raw: unknown): GeoJSONPoint | null {
  if (!isObject(raw)) return null;
  if (raw.type !== 'Point') return null;
  if (!Array.isArray(raw.coordinates)) return null;
  const [lng, lat] = raw.coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}
