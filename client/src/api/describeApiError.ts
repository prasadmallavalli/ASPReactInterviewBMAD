import type { ApiFailure } from './client';

/**
 * Renders a failed `apiFetch` result as a single human-readable message --
 * network failure (retries already exhausted by `apiFetch` itself),
 * `problem.title`/`detail` when the server sent RFC 7807 ProblemDetails, or a
 * last-resort status-code fallback for a failure response with no parseable
 * body.
 *
 * Retro fix (Epic 3, Finding I): this was duplicated three ways --
 * `ProductList.describeError`, `ProductForm.describeError`,
 * `AuthContext.describeAuthError` -- byte-identical each time. Extracted here
 * once all three copies existed, crossing the threshold the 3.4 review
 * deferred at (two copies, "no coupling reason yet").
 */
export function describeApiError(result: ApiFailure): string {
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
