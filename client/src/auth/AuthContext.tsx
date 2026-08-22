import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch } from '../api/client';
import type { ApiFailure } from '../api/client';
import type { UserDto } from '../api/types';

/**
 * Three states per this story's Always boundary -- no separate "error"
 * status. A failed mount-time session check (401 or a network hiccup) both
 * collapse to `unauthenticated`: either way there's no confirmed session, so
 * the login form is the right thing to show.
 */
export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

/**
 * `login()`'s outcome -- never thrown, matching `apiFetch`'s own contract.
 * `message` is a human-readable string already extracted from the failing
 * `ApiResult`, ready for direct display by `LoginForm`.
 */
export type LoginResult = { ok: true } | { ok: false; message: string };

export interface AuthContextValue {
  status: AuthStatus;
  user: UserDto | null;
  /** POSTs credentials, then re-checks `/me` to mint the XSRF-TOKEN cookie (see doc comment below). */
  login: (email: string, password: string) => Promise<LoginResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Renders a failed `apiFetch` result as a single human-readable message --
 * mirrors `ProductList`'s `describeError` (network failure vs.
 * `problem.title`/`detail` vs. a last-resort status-code fallback). Kept as
 * a separate copy here rather than shared/exported: this story's Code Map
 * scopes `client/src/auth/` as a fresh, self-contained directory, and the
 * two call sites (products vs. auth) have no coupling reason to share a
 * helper yet.
 */
function describeAuthError(result: ApiFailure): string {
  if (result.networkError) {
    return 'Network error -- could not reach the server. Check your connection and try again.';
  }

  const parts = [result.problem?.title, result.problem?.detail].filter(
    (part): part is string => Boolean(part),
  );
  if (parts.length > 0) {
    return parts.join(': ');
  }

  return result.status ? `Request failed (status ${result.status}).` : 'Request failed.';
}

/**
 * Minimal runtime guard on a successful `apiFetch<UserDto>` result --
 * `apiFetch` only casts the parsed JSON to `UserDto`, it never validates the
 * shape at runtime. A malformed body (missing `id`, wrong types, `null`)
 * must not be trusted as a valid authenticated user -- same defensive
 * posture as `ProductList`'s `Array.isArray` guard on `ProductDto[]`.
 */
function isUserDto(data: unknown): data is UserDto {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as UserDto).id === 'number' &&
    typeof (data as UserDto).email === 'string'
  );
}

/**
 * Shared auth state for the whole app (Stories 3.3-3.5 consume `useAuth()`
 * rather than prop-drilling). On mount, checks for an existing session via
 * `GET /api/auth/me` before anything else renders -- avoids a flash of the
 * login form for an already-authenticated session. `login()` implements the
 * two-step flow required by Story 2.3: `POST /api/auth/login` only proves
 * the credentials and sets the httpOnly `access_token` cookie; the
 * `XSRF-TOKEN` cookie Stories 3.3-3.5 need for mutations is minted only by
 * `/me`, so a successful login is immediately followed by a `/me`
 * re-check, and `login()` only resolves `{ ok: true }` once both steps have
 * succeeded.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<UserDto | null>(null);

  // Guards against a late setState after unmount, same pattern as
  // ProductList's mountedRef.
  const mountedRef = useRef(true);

  // Retro fix (Epic 3, Finding F): this doc comment (see below) claimed
  // parity with ProductList's stale-response guard, but only the
  // mountedRef half was actually implemented -- ProductList.fetchProducts
  // additionally uses a requestIdRef generation counter to reject a stale,
  // out-of-order response if this effect ever re-runs (e.g. React
  // StrictMode's dev-only double-invoke). Added here to make the claim
  // true; mounts exactly once at the app root in production, so this is a
  // correctness/consistency fix, not a live bug fix.
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const requestId = (requestIdRef.current += 1);

    apiFetch<UserDto>('/api/auth/me')
      .then((result) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }

        if (result.ok && isUserDto(result.data)) {
          setUser(result.data);
          setStatus('authenticated');
        } else {
          // 401 (no session), a network/5xx failure, and a malformed body
          // all collapse to unauthenticated -- see the AuthStatus doc
          // comment above.
          setUser(null);
          setStatus('unauthenticated');
        }
      })
      .catch(() => {
        // apiFetch is documented to never throw/reject -- this is a safety
        // net in case that contract is ever violated, so `status` doesn't
        // get stuck on 'checking' forever.
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const loginResult = await apiFetch<UserDto>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResult.ok) {
        // Invalid credentials (401) or a network/5xx failure -- either way,
        // no session was established. Auth status is left untouched (still
        // whatever it was, normally 'unauthenticated') so the caller can
        // show an inline error and let the user retry from an editable form.
        return { ok: false, message: describeAuthError(loginResult) };
      }

      // Login succeeded and set the access_token cookie, but the XSRF-TOKEN
      // cookie is only minted by /me (Story 2.3) -- re-check now, before
      // reporting success, so a caller that sees `{ ok: true }` can rely on
      // both cookies being present.
      const meResult = await apiFetch<UserDto>('/api/auth/me');
      if (!meResult.ok) {
        return { ok: false, message: describeAuthError(meResult) };
      }
      if (!isUserDto(meResult.data)) {
        return { ok: false, message: 'Unexpected response from server.' };
      }

      if (mountedRef.current) {
        setUser(meResult.data);
        setStatus('authenticated');
      }

      return { ok: true };
    } catch {
      // apiFetch is documented to never throw/reject -- this is a safety
      // net in case that contract is ever violated, so a rejection here
      // resolves as a normal login failure instead of propagating as an
      // unhandled rejection and leaving LoginForm's submit button stuck on
      // "Logging in…" forever.
      return { ok: false, message: 'Unexpected error -- please try again.' };
    }
  }, []);

  return <AuthContext.Provider value={{ status, user, login }}>{children}</AuthContext.Provider>;
}

/** Throws outside an `AuthProvider` -- a missing provider is a wiring bug, not a valid state to render around. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
