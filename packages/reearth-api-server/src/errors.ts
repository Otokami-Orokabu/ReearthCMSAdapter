/**
 * Options for constructing a {@link ReearthApiError}.
 */
export interface ReearthApiErrorOptions {
  /**
   * Underlying error if any (network failure, SDK throw, JSON parse error).
   * Accessible via `error.cause` (standard `Error.cause`).
   */
  cause?: unknown;
  /** HTTP status code, when the error originated from an HTTP response. */
  status?: number;
}

/**
 * Unified error type for all Re:Earth CMS access paths.
 *
 * Both Public API and Integration API callers throw this, so downstream code
 * only needs to `catch (e) { if (e instanceof ReearthApiError) ... }`.
 *
 * This is part of the Anti-Corruption Layer: the shape of CMS-side / SDK
 * errors is NOT exposed to callers. Map into this at the boundary.
 */
export class ReearthApiError extends Error {
  /** HTTP status code if applicable (from Integration API / Public API). */
  public readonly status: number | undefined;

  constructor(message: string, options?: ReearthApiErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ReearthApiError';
    this.status = options?.status;
  }
}
