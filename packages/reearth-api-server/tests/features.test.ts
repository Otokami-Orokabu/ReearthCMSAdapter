import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReearthApiError } from '../src/errors.js';
import type { GeoJSONFeature, GeoJSONFeatureCollection } from '../src/types.js';

const sendPublicGET = vi.fn<(url: string) => Promise<unknown>>();
vi.mock('../src/internal/http.js', () => ({
  sendPublicGET,
  publicBaseUrl: (config: { baseUrl: string; workspace: string; project: string }) =>
    `${config.baseUrl}/api/p/${config.workspace}/${config.project}`,
}));

const { listFeaturesPublic } = await import('../src/features.js');

const config = {
  baseUrl: 'https://cms.test',
  workspace: 'ws',
  project: 'proj',
  integrationToken: 'tok',
};

function feat(id: string, lng: number, lat: number): GeoJSONFeature {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {},
  };
}

function fc(features: GeoJSONFeature[]): GeoJSONFeatureCollection {
  return { type: 'FeatureCollection', features };
}

beforeEach(() => sendPublicGET.mockReset());
afterEach(() => sendPublicGET.mockReset());

describe('listFeaturesPublic — pagination', () => {
  it('stops on the first empty page (single-page model)', async () => {
    // Observed behaviour: server returns FeatureCollection with 0 features past the end.
    sendPublicGET.mockResolvedValueOnce(fc([feat('a', 139, 35)]));
    sendPublicGET.mockResolvedValueOnce(fc([]));

    const out = await listFeaturesPublic(config, 'm');
    expect(out.type).toBe('FeatureCollection');
    expect(out.features).toHaveLength(1);
    expect(sendPublicGET).toHaveBeenCalledTimes(2);
  });

  it('walks multiple pages and concatenates features', async () => {
    sendPublicGET.mockResolvedValueOnce(fc(Array.from({ length: 100 }, (_, i) => feat(`i${String(i)}`, 0, 0))));
    sendPublicGET.mockResolvedValueOnce(fc(Array.from({ length: 100 }, (_, i) => feat(`j${String(i)}`, 0, 0))));
    sendPublicGET.mockResolvedValueOnce(fc([feat('tail', 0, 0)]));
    sendPublicGET.mockResolvedValueOnce(fc([]));

    const out = await listFeaturesPublic(config, 'm');
    expect(out.features).toHaveLength(201);
    expect(sendPublicGET).toHaveBeenCalledTimes(4);
  });

  it('does NOT stop on a short page (server-side Point filter causes gaps)', async () => {
    // Observed: `per_page=3&page=1` returned 2 features even though more exist
    // later. A premature short-page break would drop data — so we must keep going.
    sendPublicGET.mockResolvedValueOnce(fc([feat('a', 0, 0), feat('b', 0, 0)])); // length < PAGE_SIZE, NOT end
    sendPublicGET.mockResolvedValueOnce(fc([feat('c', 0, 0), feat('d', 0, 0), feat('e', 0, 0)]));
    sendPublicGET.mockResolvedValueOnce(fc([]));

    const out = await listFeaturesPublic(config, 'm');
    expect(out.features.map((f) => f.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(sendPublicGET).toHaveBeenCalledTimes(3);
  });

  it('sends per_page=100 and page=1,2,... in order', async () => {
    sendPublicGET.mockResolvedValueOnce(fc([feat('a', 0, 0)]));
    sendPublicGET.mockResolvedValueOnce(fc([]));
    await listFeaturesPublic(config, 'm');
    const url1 = sendPublicGET.mock.calls[0]?.[0] ?? '';
    const url2 = sendPublicGET.mock.calls[1]?.[0] ?? '';
    expect(url1).toContain('per_page=100');
    expect(url1).toContain('page=1');
    expect(url2).toContain('page=2');
  });

  it('URL-encodes the model segment and keeps the .geojson suffix', async () => {
    sendPublicGET.mockResolvedValueOnce(fc([]));
    await listFeaturesPublic(config, 'my model');
    const url = sendPublicGET.mock.calls[0]?.[0] ?? '';
    expect(url).toContain('my%20model.geojson');
  });

  it('applies bbox filter on the fully-fetched set', async () => {
    sendPublicGET.mockResolvedValueOnce(
      fc([feat('in1', 139, 35), feat('out', 150, 35), feat('in2', 139.5, 35.5)]),
    );
    sendPublicGET.mockResolvedValueOnce(fc([]));
    const out = await listFeaturesPublic(config, 'm', { bbox: [138, 34, 140, 36] });
    expect(out.features.map((f) => f.id)).toEqual(['in1', 'in2']);
  });

  it('drops malformed features (bad type, bad geometry, bad coords) while keeping valid ones', async () => {
    // Simulate a "FeatureCollection" where the CMS slipped in odd entries.
    sendPublicGET.mockResolvedValueOnce({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'ok', geometry: { type: 'Point', coordinates: [139, 35] }, properties: {} },
        // wrong type
        { type: 'NotAFeature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
        // LineString geometry → dropped to null geometry (kept feature)
        { type: 'Feature', id: 'line', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] }, properties: {} },
        // NaN coordinates → geometry nulled
        { type: 'Feature', id: 'nan', geometry: { type: 'Point', coordinates: [Number.NaN, 0] }, properties: {} },
        // non-number coords → geometry nulled
        { type: 'Feature', id: 'str', geometry: { type: 'Point', coordinates: ['139', '35'] }, properties: {} },
        // missing everything → whole feature dropped
        null,
        { id: 'no-type' },
        // null geometry is fine (legal GeoJSON)
        { type: 'Feature', id: 'nogeom', geometry: null, properties: { a: 1 } },
      ],
    });
    sendPublicGET.mockResolvedValueOnce(fc([]));

    const out = await listFeaturesPublic(config, 'm');
    // Kept features: 'ok', 'line' (geometry nulled), 'nan' (nulled), 'str' (nulled), 'nogeom'
    expect(out.features.map((f) => f.id)).toEqual(['ok', 'line', 'nan', 'str', 'nogeom']);
    // Only 'ok' has a valid Point geometry; the rest should be null.
    const withGeom = out.features.filter((f) => f.geometry !== null);
    expect(withGeom.map((f) => f.id)).toEqual(['ok']);
  });

  it('rejects an outer shape that is not a FeatureCollection', async () => {
    sendPublicGET.mockResolvedValueOnce({ type: 'Feature', geometry: null, properties: null });
    await expect(listFeaturesPublic(config, 'm')).rejects.toThrow(/FeatureCollection/);
  });

  it('rejects when features is not an array', async () => {
    sendPublicGET.mockResolvedValueOnce({ type: 'FeatureCollection', features: 'nope' });
    await expect(listFeaturesPublic(config, 'm')).rejects.toThrow(/features is not an array/);
  });

  it('throws ReearthApiError when pagination hits MAX_PAGES (no silent truncation)', async () => {
    // Every page returns a full PAGE_SIZE batch of non-empty features, never hitting
    // the empty-page terminator → we should hit MAX_PAGES and throw.
    const fullPage = fc(Array.from({ length: 100 }, (_, i) => feat(`x${String(i)}`, 0, 0)));
    sendPublicGET.mockImplementation(async () => await Promise.resolve(fullPage));

    await expect(listFeaturesPublic(config, 'huge')).rejects.toBeInstanceOf(ReearthApiError);
    await expect(listFeaturesPublic(config, 'huge')).rejects.toThrow(
      /exceeds the pagination guard/,
    );
  });
});
