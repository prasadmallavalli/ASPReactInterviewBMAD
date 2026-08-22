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
