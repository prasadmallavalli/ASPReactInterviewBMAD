import { readCookie } from './cookies';

/**
 * RFC 7807 ProblemDetails shape, as returned by the API's `AddProblemDetails()`
 * envelope (src/Api/Program.cs) for every 4xx/5xx response -- see
 * ProductsController/CategoriesController's `Problem(...)` calls. Additional
 * server-added members (e.g. `traceId`, `instance`) pass through untyped.
 */
export interface ProblemDetails {
  title?: string;
  status?: number;
  detail?: string;
  [key: string]: unknown;
}

/** Successful `apiFetch` outcome: a parsed 2xx JSON body (or `undefined` for a 204). */
export interface ApiSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

/**
 * Failed `apiFetch` outcome -- covers both "retries exhausted after a network
 * failure" (`status: null`, `networkError: true`) and "4xx/5xx response"
 * (`status` set, `problem` parsed when the body was ProblemDetails-shaped).
 * Never thrown, never swallowed -- always a typed result the caller inspects.
 */
export interface ApiFailure {
  ok: false;
  status: number | null;
  problem: ProblemDetails | null;
  networkError: boolean;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

const DEFAULT_API_BASE_URL = 'https://localhost:7197';

/**
 * API base URL, externalized per the story's Always boundary -- never
 * hardcoded inline at call sites. Falls back to the API's default HTTPS dev
 * port (src/Api/Properties/launchSettings.json) when the env var is unset OR
 * blank -- an empty/whitespace-only value fails fast to the default rather
 * than silently resolving every request against a relative/current-origin
 * URL, matching this project's fail-fast-on-blank-config convention
 * (src/Api/Program.cs's connection-string/JWT IsNullOrWhiteSpace guards).
 */
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL: string =
  rawApiBaseUrl && rawApiBaseUrl.trim() !== '' ? rawApiBaseUrl : DEFAULT_API_BASE_URL;

/** Methods that carry the CSRF header (AD-7 / Story 2.3); GET never does. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** AD-7: retry network/5xx failures with exponential backoff, max 3 attempts total. */
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses a response body as ProblemDetails when the server declared a JSON
 * (or RFC 7807 `application/problem+json`) content type. Returns `null`
 * rather than throwing when the body is absent, non-JSON, or malformed --
 * callers must not lose the underlying status just because the body couldn't
 * be parsed.
 */
async function parseProblemDetails(response: Response): Promise<ProblemDetails | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      return body as ProblemDetails;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Typed `fetch` wrapper implementing this story's full I/O matrix:
 * - `credentials: 'include'` on every request (httpOnly `access_token` cookie rides along).
 * - `X-CSRF-TOKEN` attached from the `XSRF-TOKEN` cookie on POST/PUT/PATCH/DELETE only.
 * - Network failures and 5xx responses retried with exponential backoff, max 3 attempts total (AD-7).
 * - 4xx responses never retried.
 * - Result is always a typed `ApiResult<T>` -- never thrown, never swallowed.
 *
 * Deliberately generic and Product/Category-agnostic (Never boundary) --
 * Stories 3.2-3.5 build their specific request functions on top of this.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutating = MUTATING_METHODS.has(method);

  const headers = new Headers(init.headers);
  if (isMutating) {
    const csrfToken = readCookie('XSRF-TOKEN');
    if (csrfToken) {
      headers.set('X-CSRF-TOKEN', csrfToken);
    }
  }

  const requestInit: RequestInit = {
    ...init,
    method,
    headers,
    credentials: 'include',
  };

  const url = `${API_BASE_URL}${path}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(url, requestInit);
    } catch {
      // Network failure (offline/DNS/etc.) -- fetch throws rather than resolving.
      if (attempt < MAX_ATTEMPTS) {
        await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      return { ok: false, status: null, problem: null, networkError: true };
    }

    const isServerError = response.status >= 500 && response.status <= 599;
    if (isServerError && attempt < MAX_ATTEMPTS) {
      await delay(BASE_DELAY_MS * 2 ** (attempt - 1));
      continue;
    }

    if (response.status >= 400) {
      // 4xx: never retried, fails immediately. 5xx here means retries are exhausted.
      const problem = await parseProblemDetails(response);
      return { ok: false, status: response.status, problem, networkError: false };
    }

    // 2xx: no body assumed on 204.
    if (response.status === 204) {
      return { ok: true, status: response.status, data: undefined as T };
    }

    try {
      const data = (await response.json()) as T;
      return { ok: true, status: response.status, data };
    } catch {
      // A 2xx response with an empty or non-JSON body must not reject
      // apiFetch's promise -- same "never thrown" contract as the
      // ProblemDetails parsing path below.
      return { ok: false, status: response.status, problem: null, networkError: false };
    }
  }

  // Unreachable: the loop above always returns by its final iteration.
  return { ok: false, status: null, problem: null, networkError: true };
}
