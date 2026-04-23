/**
 * Helpers for building the MCP tool response envelope. Return types are
 * intentionally inferred so the SDK's index-signature structural match
 * is preserved; `type: 'text' as const` keeps the literal narrow.
 *
 * @internal
 */

/** Wrap an arbitrary value as a text response. `null` is rendered as
 *  the string "null" so empty-result tools stay terse. */
export function toTextResponse(data: unknown) {
  const text = data === null ? 'null' : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

/** Wrap a plain string message as a text response (no JSON layer). */
export function toTextMessage(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}
