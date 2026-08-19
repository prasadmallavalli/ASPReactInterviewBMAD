import { afterEach, describe, expect, it } from 'vitest';
import { readCookie } from './cookies';

function clearCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

describe('readCookie', () => {
  afterEach(() => {
    clearCookies();
  });

  it('returns the value when the named cookie exists', () => {
    document.cookie = 'XSRF-TOKEN=abc123';

    expect(readCookie('XSRF-TOKEN')).toBe('abc123');
  });

  it('returns null when the named cookie is absent', () => {
    document.cookie = 'OTHER-COOKIE=value';

    expect(readCookie('XSRF-TOKEN')).toBeNull();
  });

  it('returns null (does not throw) on a malformed percent-encoding', () => {
    // A stray '%' is not a valid percent-encoding sequence -- decodeURIComponent
    // throws a URIError on it. readCookie must swallow that and return null.
    document.cookie = 'XSRF-TOKEN=%E0%A4%A';

    expect(() => readCookie('XSRF-TOKEN')).not.toThrow();
    expect(readCookie('XSRF-TOKEN')).toBeNull();
  });

  it('finds the right cookie among several and decodes its value', () => {
    document.cookie = 'first=one';
    document.cookie = 'XSRF-TOKEN=hello%20world';
    document.cookie = 'last=three';

    expect(readCookie('XSRF-TOKEN')).toBe('hello world');
    expect(readCookie('first')).toBe('one');
    expect(readCookie('last')).toBe('three');
  });
});
