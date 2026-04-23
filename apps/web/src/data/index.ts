import bundledLandmarksJson from './bundled-landmarks.json';

/** Snapshot of the CMS `landmarks` model shipped with the app bundle so
 *  the first-run / fully-offline experience still has content. The
 *  runtime overwrites this from the network when online.
 *
 *  The raw shape is kept as unknown[] because the CMS wire returns
 *  certain fields (geometryObject) as JSON strings — normalisation is
 *  done in `api.ts::normalizeLandmark` before the data is handed to
 *  the UI. */
export const BUNDLED_LANDMARKS_RAW: readonly unknown[] = bundledLandmarksJson as unknown[];
