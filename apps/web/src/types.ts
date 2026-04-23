/** Flat landmark shape returned by the backend `/api/items/landmarks/all`
 *  route. Only the fields the UI actually reads are typed; unknown extra
 *  fields pass through as `Record<string, unknown>`. */
export interface Landmark {
  id: string;
  title: string;
  description: string;
  category: string;
  prefecture: string;
  location: { type: 'Point'; coordinates: [number, number] } | null;
  hero_image?: string[] | null;
  story?: string | null;
  /** Local-only + CMS-backed "visited" flag. `undefined` means the CMS
   *  omitted the field for this response (or we have never received one
   *  from the server); `true`/`false` is a known state. Using explicit
   *  undefined lets the merge step keep a locally-set true across a
   *  refresh that still sees the old server value. */
  visited?: boolean | undefined;
}

export interface Story {
  id: string;
  title: string;
  lead: string;
  hero_image?: string[] | null;
  body?: string | null;
}

/** Queued write that failed to reach the network. Flushed on the next
 *  successful fetch cycle. */
export interface PendingUpdate {
  id: string;
  patch: Record<string, unknown>;
  queuedAt: number;
}

/** Queued create that failed to reach the network. `localId` is the
 *  temporary id we gave the landmark in IndexedDB so the UI could show
 *  it immediately; on successful flush it is replaced with the CMS id. */
export interface PendingCreate {
  localId: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}
