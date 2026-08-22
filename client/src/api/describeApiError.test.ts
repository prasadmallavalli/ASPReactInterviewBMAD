import { describe, expect, it } from 'vitest';
import { describeApiError } from './describeApiError';

describe('describeApiError', () => {
  it('returns a dedicated message for a network failure', () => {
    expect(describeApiError({ ok: false, status: null, problem: null, networkError: true })).toBe(
      'Network error -- could not reach the server. Check your connection and try again.',
    );
  });

  it('joins problem.title and problem.detail when both are present', () => {
    expect(
      describeApiError({
        ok: false,
        status: 400,
        problem: { title: 'Validation failed', detail: 'Email is required' },
        networkError: false,
      }),
    ).toBe('Validation failed: Email is required');
  });

  it('returns only problem.title when detail is absent, with no stray separator', () => {
    expect(
      describeApiError({
        ok: false,
        status: 409,
        problem: { title: 'Email already registered' },
        networkError: false,
      }),
    ).toBe('Email already registered');
  });

  // Code-review finding, 2026-08-22: the title-only case above was covered,
  // but detail-only (no title) was not -- an asymmetric gap in the
  // parts.filter(...).join(': ') logic's coverage.
  it('returns only problem.detail when title is absent, with no stray separator', () => {
    expect(
      describeApiError({
        ok: false,
        status: 400,
        problem: { detail: 'Category 3 does not exist.' },
        networkError: false,
      }),
    ).toBe('Category 3 does not exist.');
  });

  it('falls back to a status-code message when there is no ProblemDetails body', () => {
    expect(
      describeApiError({ ok: false, status: 500, problem: null, networkError: false }),
    ).toBe('Request failed (status 500).');
  });

  it('falls back to a generic message when there is neither a body nor a status', () => {
    expect(describeApiError({ ok: false, status: null, problem: null, networkError: false })).toBe(
      'Request failed.',
    );
  });
});
