import net from 'node:net';
import { CMS_FIELD_TYPE_VALUES, type CmsPayload } from './types.js';
import { ReearthApiError } from './errors.js';
import { isObject } from './internal/typeGuards.js';

const FIELD_TYPE_SET: ReadonlySet<string> = new Set<string>(CMS_FIELD_TYPE_VALUES);

/**
 * Assert that an unknown value matches the CmsPayload shape.
 *
 * @throws TypeError with a message that identifies the offending field
 *   (or that the top-level value is not an object). The message is
 *   intended to surface as the body of a 400 response or a single CLI
 *   error line.
 */
export function assertCmsPayload(value: unknown): asserts value is CmsPayload {
  if (!isObject(value)) {
    throw new TypeError('Payload must be a JSON object.');
  }
  for (const [key, rawEntry] of Object.entries(value)) {
    if (!isObject(rawEntry)) {
      throw new TypeError(`Field "${key}" must be an object of shape { type, value }.`);
    }
    if (!('type' in rawEntry) || !('value' in rawEntry)) {
      throw new TypeError(`Field "${key}" is missing "type" or "value".`);
    }
    const t = rawEntry.type;
    if (typeof t !== 'string' || !FIELD_TYPE_SET.has(t)) {
      throw new TypeError(`Field "${key}" has unknown type "${String(t)}".`);
    }
  }
}

/**
 * Assert that a URL is safe to hand off to a server-side fetcher (SSRF
 * defense). Rejects non-http(s) schemes, the localhost family, and IPv4
 * or IPv6 literals inside loopback, link-local, private, CGN, or ULA
 * ranges. DNS-level checks are out of scope.
 *
 * @throws ReearthApiError with status 400 when the URL fails any of the
 *   above checks.
 */
export function assertSafeUploadUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ReearthApiError('Invalid URL syntax.', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ReearthApiError(
      `Unsupported URL scheme "${parsed.protocol}" - only http and https are allowed.`,
      { status: 400 },
    );
  }
  // URL#hostname wraps IPv6 literals in brackets; strip them so net.isIP
  // recognises the literal.
  let hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname === '' || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new ReearthApiError(`Unsafe URL host "${hostname}".`, { status: 400 });
  }
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isUnsafeIPv4(hostname)) {
    throw new ReearthApiError(`Unsafe URL host "${hostname}".`, { status: 400 });
  }
  if (ipVersion === 6 && isUnsafeIPv6(hostname)) {
    throw new ReearthApiError(`Unsafe URL host "${hostname}".`, { status: 400 });
  }
}

function isUnsafeIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGN)
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, inc. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

function isUnsafeIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  if (norm === '::1' || norm === '::') return true;
  const firstGroup = norm.split(':')[0] ?? '';
  const first = firstGroup === '' ? 0 : Number.parseInt(firstGroup, 16);
  if (Number.isNaN(first)) return true;
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  // IPv4-mapped IPv6 (::ffff:*). Node's URL parser normalises the dotted
  // form into compressed hex, so both shapes are handled here.
  const v4 = extractMappedIPv4(norm);
  if (v4 !== null && isUnsafeIPv4(v4)) return true;
  return false;
}

function extractMappedIPv4(norm: string): string | null {
  if (!norm.startsWith('::ffff:')) return null;
  const rest = norm.slice('::ffff:'.length);
  if (net.isIPv4(rest)) return rest;
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
  if (hex === null) return null;
  const high = Number.parseInt(hex[1] ?? '', 16);
  const low = Number.parseInt(hex[2] ?? '', 16);
  if (Number.isNaN(high) || Number.isNaN(low)) return null;
  const a = (high >> 8) & 0xff;
  const b = high & 0xff;
  const c = (low >> 8) & 0xff;
  const d = low & 0xff;
  return `${String(a)}.${String(b)}.${String(c)}.${String(d)}`;
}
