import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReearthApiError } from '../src/errors.js';

// Mock the HTTP layer so we can script page-by-page responses without
// touching the network. Path must match how public.ts imports it (with `.js`).
const sendPublicGET = vi.fn<(url: string) => Promise<unknown>>();
vi.mock('../src/internal/http.js', () => ({
  sendPublicGET,
  publicBaseUrl: (config: { baseUrl: string; workspace: string; project: string }) =>
    `${config.baseUrl}/api/p/${config.workspace}/${config.project}`,
}));

// Importing after vi.mock so the mock is applied.
const { listItemsPublic } = await import('../src/public.js');

interface TestItem {
  id: string;
  n?: number;
  location?: { type: string; coordinates: [number, number] };
}

const config = {
  baseUrl: 'https://cms.test',
  workspace: 'ws',
  project: 'proj',
  integrationToken: 'tok',
};

function page(items: TestItem[], totalCount: number, pageNum: number, perPage: number): {
  results: TestItem[];
  totalCount: number;
  page: number;
  perPage: number;
} {
  return { results: items, totalCount, page: pageNum, perPage };
}

function range(from: number, to: number): TestItem[] {
  const out: TestItem[] = [];
  for (let i = from; i < to; i++) out.push({ id: `i${String(i)}`, n: i });
  return out;
}

beforeEach(() => {
  sendPublicGET.mockReset();
});

afterEach(() => {
  sendPublicGET.mockReset();
});

describe('listItemsPublic — pagination', () => {
  it('returns a single page when results.length < PAGE_SIZE', async () => {
    sendPublicGET.mockResolvedValueOnce(page(range(0, 5), 5, 1, 100));
    const out = await listItemsPublic<TestItem>(config, 'm');
    expect(out).toHaveLength(5);
    expect(sendPublicGET).toHaveBeenCalledTimes(1);
  });

  it('keeps fetching until totalCount is reached (boundary: exactly PAGE_SIZE on last page)', async () => {
    // totalCount=200, PAGE_SIZE=100 → exactly 2 pages of 100.
    sendPublicGET.mockResolvedValueOnce(page(range(0, 100), 200, 1, 100));
    sendPublicGET.mockResolvedValueOnce(page(range(100, 200), 200, 2, 100));
    const out = await listItemsPublic<TestItem>(config, 'm');
    expect(out).toHaveLength(200);
    expect(sendPublicGET).toHaveBeenCalledTimes(2);
  });

  it('stops when a page returns fewer than PAGE_SIZE items (totalCount disagrees)', async () => {
    // Server says 250 but actually only 2 pages exist — short page should stop us.
    sendPublicGET.mockResolvedValueOnce(page(range(0, 100), 250, 1, 100));
    sendPublicGET.mockResolvedValueOnce(page(range(100, 150), 250, 2, 100));
    const out = await listItemsPublic<TestItem>(config, 'm');
    expect(out).toHaveLength(150);
    expect(sendPublicGET).toHaveBeenCalledTimes(2);
  });

  it('applies client-side offset + limit AFTER fetching all pages (regression for the old offset bug)', async () => {
    // Pre-fix behaviour fetched only `per_page=10` then did .slice(20, 30) → [].
    // Post-fix should fetch all pages, then slice.
    sendPublicGET.mockResolvedValueOnce(page(range(0, 50), 50, 1, 100));
    const out = await listItemsPublic<TestItem>(config, 'm', { offset: 20, limit: 10 });
    expect(out).toHaveLength(10);
    expect(out[0]?.n).toBe(20);
    expect(out[9]?.n).toBe(29);
  });

  it('applies bbox filter on the fully-fetched set', async () => {
    const p = (lng: number, lat: number): { type: 'Point'; coordinates: [number, number] } => ({
      type: 'Point',
      coordinates: [lng, lat],
    });
    const items: TestItem[] = [
      { id: 'a', location: p(139, 35) }, // inside
      { id: 'b', location: p(150, 35) }, // outside
      { id: 'c', location: p(139.5, 35.5) }, // inside
    ];
    sendPublicGET.mockResolvedValueOnce(page(items, 3, 1, 100));
    const out = await listItemsPublic<TestItem>(config, 'm', { bbox: [138, 34, 140, 36] });
    expect(out.map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('sends page=1,2,... with per_page=100', async () => {
    sendPublicGET.mockResolvedValueOnce(page(range(0, 100), 150, 1, 100));
    sendPublicGET.mockResolvedValueOnce(page(range(100, 150), 150, 2, 100));
    await listItemsPublic<TestItem>(config, 'm');
    expect(sendPublicGET).toHaveBeenCalledTimes(2);
    const url1 = sendPublicGET.mock.calls[0]?.[0] ?? '';
    const url2 = sendPublicGET.mock.calls[1]?.[0] ?? '';
    expect(url1).toContain('per_page=100');
    expect(url1).toContain('page=1');
    expect(url2).toContain('page=2');
  });

  it('URL-encodes the model segment', async () => {
    sendPublicGET.mockResolvedValueOnce(page([], 0, 1, 100));
    await listItemsPublic<TestItem>(config, 'my model/with slash');
    const url = sendPublicGET.mock.calls[0]?.[0] ?? '';
    expect(url).toContain('my%20model%2Fwith%20slash');
  });

  it('throws ReearthApiError when pagination hits MAX_PAGES (no silent truncation)', async () => {
    // Server always reports totalCount=999999 and always returns a full page,
    // so the loop keeps going until MAX_PAGES. Silence stderr noise.
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    sendPublicGET.mockImplementation(async () =>
      await Promise.resolve(page(range(0, 100), 999_999, 1, 100)),
    );
    await expect(listItemsPublic<TestItem>(config, 'huge')).rejects.toBeInstanceOf(
      ReearthApiError,
    );
    await expect(listItemsPublic<TestItem>(config, 'huge')).rejects.toThrow(
      /exceeds the pagination guard/,
    );
  });
});
