/**
 * IndexedDB-backed local store.
 *
 *   landmarks       current known set (bundled snapshot first, overwritten
 *                   when the network sync succeeds)
 *   stories         same, for the `stories` model
 *   pendingUpdates  writes that could not reach the network; flushed on
 *                   the next successful fetch cycle
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { Landmark, PendingCreate, PendingUpdate, Story } from './types.ts';

const DB_NAME = 'meisho-cache';
const DB_VERSION = 3;
const LANDMARKS = 'landmarks';
const STORIES = 'stories';
const PENDING = 'pendingUpdates';
const PENDING_CREATES = 'pendingCreates';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(LANDMARKS)) {
          d.createObjectStore(LANDMARKS, { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains(STORIES)) {
          d.createObjectStore(STORIES, { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains(PENDING)) {
          d.createObjectStore(PENDING, { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains(PENDING_CREATES)) {
          d.createObjectStore(PENDING_CREATES, { keyPath: 'localId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllLandmarks(): Promise<Landmark[]> {
  try {
    return (await (await db()).getAll(LANDMARKS)) as Landmark[];
  } catch {
    return [];
  }
}

export async function getLandmark(id: string): Promise<Landmark | null> {
  try {
    const v = await (await db()).get(LANDMARKS, id);
    return v ? (v as Landmark) : null;
  } catch {
    return null;
  }
}

/**
 * Upsert each landmark, merging incoming fields onto whatever we had
 * locally. Missing local entries are inserted. Intentionally does NOT
 * delete locally-known ids that are absent from `incoming`, so bundled
 * content survives a partial fetch.
 *
 * `visited` uses a local-first rule: the incoming value only overrides
 * when it is explicitly `true` or `false`. An `undefined` incoming
 * (CMS has no `visited` field yet, or the server legitimately omits it)
 * keeps the local value. This lets an optimistic local toggle survive
 * the refresh roundtrip even while the write is still queued.
 */
export async function mergeLandmarks(incoming: readonly Landmark[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(LANDMARKS, 'readwrite');
  for (const next of incoming) {
    const prev = (await tx.store.get(next.id)) as Landmark | undefined;
    let merged: Landmark;
    if (prev === undefined) {
      merged = next;
    } else {
      merged = { ...prev, ...next };
      if (next.visited === undefined) merged.visited = prev.visited;
    }
    await tx.store.put(merged);
  }
  await tx.done;
}

/**
 * Patch the locally-known landmark with the given partial fields. Used
 * for visited toggles so the UI sees the change before (or even without)
 * a network round trip. Returns false when the id is not known locally
 * (per the requirement: "コンテンツが見つからない場合は、更新しないで良い").
 */
export async function patchLandmarkLocal(
  id: string,
  patch: Partial<Landmark>,
): Promise<boolean> {
  const d = await db();
  const tx = d.transaction(LANDMARKS, 'readwrite');
  const prev = (await tx.store.get(id)) as Landmark | undefined;
  if (prev === undefined) {
    await tx.done;
    return false;
  }
  await tx.store.put({ ...prev, ...patch });
  await tx.done;
  return true;
}

/** Insert a freshly-created landmark into the local store. Used by
 *  optimistic create: the entry carries a local-only id until the server
 *  accepts it, at which point `replaceLandmarkId` swaps it for the CMS
 *  id. */
export async function putLandmark(landmark: Landmark): Promise<void> {
  await (await db()).put(LANDMARKS, landmark);
}

/** Swap a locally-assigned id with the server-assigned one once a
 *  pending create is accepted. Old record is removed, the incoming
 *  `next` record (carrying the new id) is inserted in the same tx so
 *  the listing never double-shows the landmark. */
export async function replaceLandmarkId(
  oldId: string,
  next: Landmark,
): Promise<void> {
  const d = await db();
  const tx = d.transaction(LANDMARKS, 'readwrite');
  await tx.store.delete(oldId);
  await tx.store.put(next);
  await tx.done;
}

export async function getAllStories(): Promise<Story[]> {
  try {
    return (await (await db()).getAll(STORIES)) as Story[];
  } catch {
    return [];
  }
}

export async function getStory(id: string): Promise<Story | null> {
  try {
    const v = await (await db()).get(STORIES, id);
    return v ? (v as Story) : null;
  } catch {
    return null;
  }
}

export async function mergeStories(incoming: readonly Story[]): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORIES, 'readwrite');
  for (const next of incoming) {
    const prev = (await tx.store.get(next.id)) as Story | undefined;
    const merged: Story = prev === undefined ? next : { ...prev, ...next };
    await tx.store.put(merged);
  }
  await tx.done;
}

export async function getAllPending(): Promise<PendingUpdate[]> {
  try {
    return (await (await db()).getAll(PENDING)) as PendingUpdate[];
  } catch {
    return [];
  }
}

export async function putPending(entry: PendingUpdate): Promise<void> {
  await (await db()).put(PENDING, entry);
}

export async function deletePending(id: string): Promise<void> {
  await (await db()).delete(PENDING, id);
}

/** Rewrite any queued PATCHes that target `oldId` to use `newId`
 *  instead. Called after a pending create is accepted so subsequent
 *  flushes hit the real CMS id rather than the local-only one. */
export async function rewritePendingId(oldId: string, newId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(PENDING, 'readwrite');
  const row = (await tx.store.get(oldId)) as PendingUpdate | undefined;
  if (row !== undefined) {
    await tx.store.delete(oldId);
    await tx.store.put({ ...row, id: newId });
  }
  await tx.done;
}

export async function getAllPendingCreates(): Promise<PendingCreate[]> {
  try {
    return (await (await db()).getAll(PENDING_CREATES)) as PendingCreate[];
  } catch {
    return [];
  }
}

export async function putPendingCreate(entry: PendingCreate): Promise<void> {
  await (await db()).put(PENDING_CREATES, entry);
}

export async function deletePendingCreate(localId: string): Promise<void> {
  await (await db()).delete(PENDING_CREATES, localId);
}
