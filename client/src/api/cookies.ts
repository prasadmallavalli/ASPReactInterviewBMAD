/**
 * Reads a single cookie's value from `document.cookie` by name.
 *
 * Used to read the JS-readable `XSRF-TOKEN` cookie (set by the API's
 * `GET /api/auth/me`, never by `Login` -- see src/Api/Controllers/AuthController.cs)
 * so its value can be echoed back as the `X-CSRF-TOKEN` header on mutating
 * requests. The httpOnly `access_token` cookie is never readable here by
 * design (AD-5) -- it rides along automatically via `credentials: 'include'`.
 *
 * @param name - the exact cookie name to look up (case-sensitive).
 * @returns the cookie's decoded value, or `null` if no cookie with that name exists.
 */
export function readCookie(name: string): string | null {
  if (typeof document === 'undefined' || !document.cookie) {
    return null;
  }

  const cookies = document.cookie.split('; ');

  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex);
    if (cookieName === name) {
      try {
        return decodeURIComponent(cookie.slice(separatorIndex + 1));
      } catch {
        // Malformed percent-encoding (a stray `%`) -- treat as absent rather
        // than throwing, matching this function's "never throws" contract
        // (apiFetch calls this synchronously ahead of its own retry loop).
        return null;
      }
    }
  }

  return null;
}
