/**
 * A CMS asset (uploaded file). Once created, the asset can be referenced
 * from an item's asset-typed field via its id.
 */
export interface CmsAsset {
  /** Asset UUID. Use this in item field values of type `asset`. */
  id: string;
  /** Public URL of the asset (signed / CDN-backed depending on CMS config). */
  url: string;
  /** Original filename (often derived from the source URL or upload). */
  name?: string;
  /** MIME type detected by the CMS on upload. */
  contentType?: string;
  /** File size in bytes (when known). */
  totalSize?: number;
  /** Whether the asset is currently public (affects url accessibility). */
  public: boolean;
  createdAt: string;
  updatedAt: string;
}
