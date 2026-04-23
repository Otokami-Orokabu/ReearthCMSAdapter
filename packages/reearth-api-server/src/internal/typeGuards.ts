/**
 * Shared runtime type guards.
 *
 * @internal
 */

/**
 * Narrow unknown to a plain JSON-style object (non-null, non-array).
 * Returning Record<string, unknown> lets callers index properties without
 * further casts.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
