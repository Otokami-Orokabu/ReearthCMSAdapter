/**
 * Network layer + offline orchestration.
 *
 * Data flow for landmarks and stories:
 *   1. UI reads from the in-memory state, which was seeded from IndexedDB
 *      (or the bundled snapshot on first run).
 *   2. On app start and when reconnecting, `syncLandmarks` / `syncStories`
 *      hit the network, merge the result into IndexedDB, and return the
 *      merged list.
 *   3. Writes go through `patchLandmark`: always updated locally first,
 *      then sent to the network (or queued in IndexedDB when offline).
 *   4. After a successful sync, `flushPending` replays queued writes.
 */

import { BUNDLED_LANDMARKS_RAW } from './data/index.ts';
import type { Landmark, PendingUpdate, Story } from './types.ts';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Normalise a raw landmark from the CMS wire. `location` arrives as a
 *  JSON-encoded string for geometryObject fields, so it is parsed here
 *  once and handed to the UI as a real object. Unknown/malformed
 *  entries yield null so the caller can skip them. */
function normalizeLandmark(raw: unknown): Landmark | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string') return null;
  const location = parseLocation(raw.location);
  const hero = raw.hero_image;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '(no title)',
    description: typeof raw.description === 'string' ? raw.description : '',
    category: typeof raw.category === 'string' ? raw.category : '',
    prefecture: typeof raw.prefecture === 'string' ? raw.prefecture : '',
    location,
    hero_image: Array.isArray(hero) ? (hero.filter((u) => typeof u === 'string') as string[]) : null,
    story: typeof raw.story === 'string' ? raw.story : null,
    // visited は optional: サーバ応答に visited field が無い (CMS 未追加)
    // ときは undefined を返し、merge 側でローカル値を保持する。
    visited: typeof raw.visited === 'boolean' ? raw.visited : undefined,
  };
}

function parseLocation(v: unknown): Landmark['location'] {
  let obj: unknown = v;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch { return null; }
  }
  if (!isObject(obj)) return null;
  if (obj.type !== 'Point') return null;
  const coords = obj.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

function normalizeStory(raw: unknown): Story | null {
  if (!isObject(raw)) return null;
  if (typeof raw.id !== 'string') return null;
  const hero = raw.hero_image;
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '(no title)',
    lead: typeof raw.lead === 'string' ? raw.lead : '',
    hero_image: Array.isArray(hero) ? (hero.filter((u) => typeof u === 'string') as string[]) : null,
    body: typeof raw.body === 'string' ? raw.body : null,
  };
}

function normalizeMany<T>(raw: readonly unknown[], fn: (x: unknown) => T | null): T[] {
  const out: T[] = [];
  for (const r of raw) {
    const n = fn(r);
    if (n !== null) out.push(n);
  }
  return out;
}
import {
  deletePending,
  deletePendingCreate,
  getAllLandmarks,
  getAllPending,
  getAllPendingCreates,
  getAllStories,
  getLandmark,
  mergeLandmarks,
  mergeStories,
  patchLandmarkLocal,
  putLandmark,
  putPending,
  putPendingCreate,
  replaceLandmarkId,
  rewritePendingId,
} from './store.ts';

interface ListResponse<T> {
  items: T[];
}

const BUNDLED_LANDMARKS: readonly Landmark[] =
  normalizeMany(BUNDLED_LANDMARKS_RAW, normalizeLandmark);

/**
 * Seed IndexedDB from the bundled landmarks snapshot if the store is
 * empty. Safe to call multiple times; later incoming data from the
 * network is merged on top.
 */
async function seedBundledIfEmpty(): Promise<void> {
  const existing = await getAllLandmarks();
  if (existing.length === 0) {
    await mergeLandmarks(BUNDLED_LANDMARKS);
  }
}

/**
 * Load landmarks for the UI: prefer IndexedDB, fall back to the bundled
 * snapshot when the DB is empty (first run). Never hits the network.
 */
export async function loadLandmarks(): Promise<Landmark[]> {
  await seedBundledIfEmpty();
  const rows = await getAllLandmarks();
  return rows.length > 0 ? rows : [...BUNDLED_LANDMARKS];
}

/**
 * Fetch landmarks from the network, merge into IndexedDB, and return the
 * merged list. On network failure, returns the last-known state from
 * IndexedDB / bundle instead of throwing.
 */
export async function syncLandmarks(): Promise<{ items: Landmark[]; online: boolean }> {
  await seedBundledIfEmpty();
  try {
    const res = await fetch('/api/items/landmarks/all');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ListResponse<unknown>;
    const items = normalizeMany(body.items, normalizeLandmark);
    await mergeLandmarks(items);
    await flushPending().catch(() => undefined);
    const merged = await getAllLandmarks();
    return { items: merged, online: true };
  } catch {
    const fallback = await loadLandmarks();
    return { items: fallback, online: false };
  }
}

export async function loadStories(): Promise<Story[]> {
  return await getAllStories();
}

export async function syncStories(): Promise<{ items: Story[]; online: boolean }> {
  try {
    const res = await fetch('/api/items/stories/all');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ListResponse<unknown>;
    const items = normalizeMany(body.items, normalizeStory);
    await mergeStories(items);
    const merged = await getAllStories();
    return { items: merged, online: true };
  } catch {
    return { items: await loadStories(), online: false };
  }
}

export interface CmsFieldPayload {
  type: 'text' | 'textArea' | 'markdown' | 'bool' | 'integer' | 'number' | 'select' | 'url';
  value: unknown;
}

/**
 * Create a new landmark. Always inserts into IndexedDB first under a
 * `local-<uuid>` id (so the UI can navigate to it immediately), then
 * tries to POST to the server. On success the local id is swapped for
 * the CMS-assigned id; on failure the payload is queued in
 * `pendingCreates` and flushed on the next successful sync.
 *
 * The CMS creates items as drafts — they become visible via the Public
 * API only after being published, but the Web app reads `/api/items/
 * <model>/all` which includes drafts, so the round-trip is usually
 * invisible to the user after a subsequent sync.
 */
export async function createLandmark(
  seed: Omit<Landmark, 'id'>,
  wire: Record<string, CmsFieldPayload>,
): Promise<{ landmark: Landmark; sent: boolean }> {
  const localId = `local-${crypto.randomUUID()}`;
  const local: Landmark = { ...seed, id: localId };
  await putLandmark(local);

  try {
    const res = await fetch('/api/items/landmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wire),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: unknown = await res.json();
    if (!isObject(body) || typeof body.id !== 'string') {
      throw new Error('Invalid create response');
    }
    const merged: Landmark = { ...local, id: body.id };
    await replaceLandmarkId(localId, merged);
    return { landmark: merged, sent: true };
  } catch {
    await putPendingCreate({
      localId,
      payload: wire as unknown as Record<string, unknown>,
      queuedAt: Date.now(),
    });
    return { landmark: local, sent: false };
  }
}

/**
 * Patch a landmark. Always updates IndexedDB first (optimistic), then
 * tries to send to the server. When offline or the request fails, the
 * patch is queued in IndexedDB for a later flush. Returns `true` when
 * the landmark existed locally; `false` means the id was unknown and
 * nothing was changed (per "not found なら更新しない").
 */
export async function patchLandmark(
  id: string,
  patch: Partial<Landmark>,
  wire: Record<string, CmsFieldPayload>,
): Promise<{ ok: boolean; sent: boolean }> {
  const applied = await patchLandmarkLocal(id, patch);
  if (!applied) return { ok: false, sent: false };

  try {
    const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wire),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, sent: true };
  } catch {
    const entry: PendingUpdate = {
      id,
      patch: wire as unknown as Record<string, unknown>,
      queuedAt: Date.now(),
    };
    await putPending(entry);
    return { ok: true, sent: false };
  }
}

/**
 * Replay queued writes after a successful sync. Creates run first so
 * the server id exists before any queued patches on that landmark try
 * to hit the network; when a create succeeds we also rewrite any
 * patch-queue entries pointing at the old local id.
 *
 * Per-entry rules:
 *   - create: success → swap local id for CMS id, drop from queue.
 *             failure (any non-2xx or network) → keep for next cycle.
 *   - patch:  success → drop from queue.
 *             404    → drop (the patch would 404 forever).
 *             other  → keep for next cycle.
 */
export async function flushPending(): Promise<void> {
  const creates = await getAllPendingCreates();
  for (const entry of creates) {
    try {
      const res = await fetch('/api/items/landmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      });
      if (!res.ok) continue;
      const body: unknown = await res.json();
      if (!isObject(body) || typeof body.id !== 'string') continue;
      const local = await getLandmark(entry.localId);
      if (local !== null) {
        await replaceLandmarkId(entry.localId, { ...local, id: body.id });
      }
      await rewritePendingId(entry.localId, body.id);
      await deletePendingCreate(entry.localId);
    } catch {
      // still offline — leave it in the queue
    }
  }

  const queue = await getAllPending();
  for (const entry of queue) {
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(entry.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.patch),
      });
      if (res.ok) {
        await deletePending(entry.id);
      } else if (res.status === 404) {
        // target gone — drop the queued write to avoid permanent retries
        await deletePending(entry.id);
      }
    } catch {
      // still offline — leave it in the queue
    }
  }
}

/** Check whether a specific landmark id has a queued pending write. */
export async function isQueued(id: string): Promise<boolean> {
  const queue = await getAllPending();
  return queue.some((q) => q.id === id);
}

/** Re-read a single landmark from IndexedDB. Handy after patchLandmark. */
export async function loadLandmark(id: string): Promise<Landmark | null> {
  await seedBundledIfEmpty();
  return await getLandmark(id);
}
