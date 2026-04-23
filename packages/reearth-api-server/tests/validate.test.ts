import { describe, it, expect } from 'vitest';
import { assertCmsPayload, CMS_FIELD_TYPE_VALUES } from '../src/index.js';
import { assertSafeUploadUrl } from '../src/validate.js';
import { ReearthApiError } from '../src/errors.js';

describe('assertCmsPayload', () => {
  it('does not throw on a valid payload', () => {
    expect(() =>
      assertCmsPayload({ title: { type: 'text', value: 'Hi' } }),
    ).not.toThrow();
  });

  it('accepts an empty object vacuously', () => {
    expect(() => assertCmsPayload({})).not.toThrow();
  });

  it('accepts every documented CmsFieldType', () => {
    for (const type of CMS_FIELD_TYPE_VALUES) {
      expect(() => assertCmsPayload({ x: { type, value: null } })).not.toThrow();
    }
  });

  it('throws with a top-level message when value is not an object', () => {
    expect(() => assertCmsPayload(null)).toThrow(/Payload must be a JSON object/);
    expect(() => assertCmsPayload([])).toThrow(/Payload must be a JSON object/);
    expect(() => assertCmsPayload('string')).toThrow(/Payload must be a JSON object/);
    expect(() => assertCmsPayload(42)).toThrow(/Payload must be a JSON object/);
  });

  it('throws with the offending key when an entry is not an object', () => {
    expect(() => assertCmsPayload({ title: 'plain' })).toThrow(/"title"/);
    expect(() => assertCmsPayload({ title: null })).toThrow(/"title"/);
    expect(() => assertCmsPayload({ title: 42 })).toThrow(/"title"/);
  });

  it('throws when type or value key is missing', () => {
    expect(() => assertCmsPayload({ t: { type: 'text' } })).toThrow(/missing "type" or "value"/);
    expect(() => assertCmsPayload({ t: { value: 'x' } })).toThrow(/missing "type" or "value"/);
  });

  it('throws when type is not a valid CmsFieldType', () => {
    expect(() => assertCmsPayload({ t: { type: 'bogus', value: 1 } })).toThrow(
      /unknown type "bogus"/,
    );
  });

  it('fails on the first invalid entry even if earlier ones are valid', () => {
    expect(() =>
      assertCmsPayload({
        good: { type: 'text', value: 'ok' },
        bad: { type: 'nope', value: 'x' },
      }),
    ).toThrow(/unknown type "nope"/);
  });
});

describe('assertSafeUploadUrl', () => {
  it('accepts plain http/https public URLs', () => {
    expect(() => assertSafeUploadUrl('https://example.com/a.png')).not.toThrow();
    expect(() => assertSafeUploadUrl('http://example.com:8080/a.png')).not.toThrow();
    expect(() => assertSafeUploadUrl('https://8.8.8.8/a.png')).not.toThrow();
  });

  it('rejects malformed URLs', () => {
    expect(() => assertSafeUploadUrl('not a url')).toThrow(ReearthApiError);
  });

  it('rejects non-http(s) schemes', () => {
    for (const u of [
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://example.com/x',
      'data:text/plain,hi',
      'javascript:alert(1)',
    ]) {
      expect(() => assertSafeUploadUrl(u)).toThrow(/scheme/);
    }
  });

  it('rejects localhost variants', () => {
    for (const u of [
      'http://localhost/',
      'http://LOCALHOST:8080/',
      'http://service.localhost/',
    ]) {
      expect(() => assertSafeUploadUrl(u)).toThrow(/Unsafe URL host/);
    }
  });

  it('rejects IPv4 loopback, link-local, private, and CGN ranges', () => {
    for (const u of [
      'http://127.0.0.1/',
      'http://127.1.2.3/',
      'http://0.0.0.0/',
      'http://10.0.0.1/',
      'http://172.16.0.1/',
      'http://172.31.255.255/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://100.64.0.1/',
    ]) {
      expect(() => assertSafeUploadUrl(u)).toThrow(/Unsafe URL host/);
    }
  });

  it('accepts IPv4 addresses adjacent to private ranges', () => {
    for (const u of [
      'http://172.15.0.1/',
      'http://172.32.0.1/',
      'http://11.0.0.1/',
      'http://100.63.255.255/',
      'http://100.128.0.1/',
    ]) {
      expect(() => assertSafeUploadUrl(u)).not.toThrow();
    }
  });

  it('rejects IPv6 loopback, link-local, ULA, and IPv4-mapped private', () => {
    for (const u of [
      'http://[::1]/',
      'http://[fe80::1]/',
      'http://[febf::1]/',
      'http://[fc00::1]/',
      'http://[fd12:3456::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:192.168.0.1]/',
    ]) {
      expect(() => assertSafeUploadUrl(u)).toThrow(/Unsafe URL host/);
    }
  });

  it('accepts IPv6 addresses outside the unsafe ranges', () => {
    expect(() => assertSafeUploadUrl('http://[2001:db8::1]/')).not.toThrow();
    expect(() => assertSafeUploadUrl('http://[::ffff:8.8.8.8]/')).not.toThrow();
  });

  it('attaches status=400 for client-error handling at HTTP adapter', () => {
    try {
      assertSafeUploadUrl('http://127.0.0.1/');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ReearthApiError);
      if (e instanceof ReearthApiError) expect(e.status).toBe(400);
    }
  });
});
