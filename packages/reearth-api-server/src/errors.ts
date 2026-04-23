/** Options for constructing a ReearthApiError. */
export interface ReearthApiErrorOptions {
  /** Underlying cause; exposed as error.cause. */
  cause?: unknown;
  /** HTTP status code when the error originated from an HTTP response. */
  status?: number;
}

/**
 * Unified error type thrown from the package. Callers can distinguish
 * known (catchable) errors from unexpected ones with
 * `err instanceof ReearthApiError`; HTTP status, when known, is on
 * err.status.
 */
export class ReearthApiError extends Error {
  /** HTTP status code if the error originated from an HTTP response. */
  public readonly status: number | undefined;

  constructor(message: string, options?: ReearthApiErrorOptions) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ReearthApiError';
    this.status = options?.status;
  }
}
