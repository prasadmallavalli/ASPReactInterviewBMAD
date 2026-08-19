import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, apiFetch } from './client';

function clearCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    clearCookies();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // I/O matrix: GET request -> credentials: include, no X-CSRF-TOKEN header.
  it('sets credentials: include and never attaches X-CSRF-TOKEN on GET requests', async () => {
    document.cookie = 'XSRF-TOKEN=should-not-be-sent';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ hello: string }>('/api/products');

    expect(result).toEqual({ ok: true, status: 200, data: { hello: 'world' } });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/api/products`);
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).has('X-CSRF-TOKEN')).toBe(false);
  });

  // Regression guard for the fallback logic itself (not just self-consistency
  // with the constant under test): the literal default must be
  // 'https://localhost:7197' when VITE_API_BASE_URL is unset in this test env.
  it('defaults API_BASE_URL to the API HTTPS dev port when VITE_API_BASE_URL is unset', () => {
    expect(API_BASE_URL).toBe('https://localhost:7197');
  });

  // I/O matrix: mutating request with CSRF cookie present -> header attached with the cookie's value.
  it('attaches X-CSRF-TOKEN from the XSRF-TOKEN cookie on mutating requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc123';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 1, name: 'Widget' }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Widget' }),
    });

    expect(result.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get('X-CSRF-TOKEN')).toBe('abc123');
    expect(init.credentials).toBe('include');
  });

  // Edge case beyond the matrix: mutating request with no CSRF cookie set -- header simply omitted.
  it('omits X-CSRF-TOKEN on mutating requests when the cookie is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 200));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/products/1', { method: 'DELETE' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has('X-CSRF-TOKEN')).toBe(false);
  });

  // I/O matrix: network failure -> retried up to 3 attempts total, then a typed error result.
  it('retries network failures up to 3 attempts total, then returns a typed error result', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = apiFetch('/api/products');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ ok: false, status: null, problem: null, networkError: true });
  });

  // AD-7's actual point: recovery after a transient network failure, not just
  // "eventually gives up." A regression that always returned the first
  // failure (ignoring a later success) would still pass the "retries
  // exhausted" test above but must fail this one.
  it('recovers and returns a typed success result when a later attempt succeeds after a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Widget' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = apiFetch<{ id: number; name: string }>('/api/products');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, status: 200, data: { id: 1, name: 'Widget' } });
  });

  // Same recovery guarantee for the 5xx path.
  it('recovers and returns a typed success result when a later attempt succeeds after a 5xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ title: 'Server error', status: 503 }, 503))
      .mockResolvedValueOnce(jsonResponse({ id: 2, name: 'Gadget' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = apiFetch<{ id: number; name: string }>('/api/products');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, status: 200, data: { id: 2, name: 'Gadget' } });
  });

  // AD-7: exponential backoff between retry attempts.
  it('backs off exponentially between retry attempts', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const resultPromise = apiFetch('/api/products');
    await vi.runAllTimersAsync();
    await resultPromise;

    const delays = setTimeoutSpy.mock.calls.map(([, ms]) => ms);
    expect(delays).toEqual([300, 600]);
  });

  // I/O matrix: 5xx response -> retried up to 3 attempts total, then a typed error with parsed ProblemDetails.
  it('retries 5xx responses up to 3 attempts total, then returns a typed error with parsed ProblemDetails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ title: 'Server error', status: 503, detail: 'boom' }, 503));
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = apiFetch('/api/products');
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      status: 503,
      problem: { title: 'Server error', status: 503, detail: 'boom' },
      networkError: false,
    });
  });

  // I/O matrix: 4xx response -> not retried, fails immediately with parsed ProblemDetails.
  it('does not retry 4xx responses and returns a typed error with parsed ProblemDetails immediately', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ title: 'Invalid category', status: 400, detail: 'Category 9 does not exist.' }, 400),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/products', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      status: 400,
      problem: { title: 'Invalid category', status: 400, detail: 'Category 9 does not exist.' },
      networkError: false,
    });
  });

  // I/O matrix: 2xx response -> parsed JSON body returned as a typed success result.
  it('returns the parsed JSON body as a typed success result on 2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{ id: 1, name: 'Widget' }], 200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ id: number; name: string }[]>('/api/products');

    expect(result).toEqual({ ok: true, status: 200, data: [{ id: 1, name: 'Widget' }] });
  });

  // I/O matrix: 2xx response, 204 specifically -> no body assumed.
  it('returns a typed success result with no body assumed on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/products/1', { method: 'DELETE' });

    expect(result).toEqual({ ok: true, status: 204, data: undefined });
  });

  // Edge case beyond the matrix: a 4xx/5xx body that isn't JSON-shaped ProblemDetails
  // must not throw or lose the status -- problem is simply null.
  it('returns problem: null when a failure response has no JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/products/999');

    expect(result).toEqual({ ok: false, status: 404, problem: null, networkError: false });
  });
});
