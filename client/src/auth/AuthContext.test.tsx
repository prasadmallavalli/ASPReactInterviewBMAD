import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { UserDto } from '../api/types';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return { id: 1, email: 'user@example.com', ...overrides };
}

/** Minimal consumer exposing AuthContext's state/login() to the DOM for assertions. */
function Probe() {
  const { status, user, login } = useAuth();
  const [loginResult, setLoginResult] = useState('idle');

  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="user">{user?.email ?? 'none'}</p>
      <p data-testid="login-result">{loginResult}</p>
      <button
        type="button"
        onClick={async () => {
          const result = await login('user@example.com', 'password123');
          setLoginResult(result.ok ? 'ok' : result.message);
        }}
      >
        trigger-login
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthContext', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // I/O matrix: mount-time /me check pending -> 'checking' (neither login form nor ProductList).
  it('starts in "checking" while the mount-time /me call is in flight', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {})); // never resolves

    renderProbe();

    expect(screen.getByTestId('status')).toHaveTextContent('checking');
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/auth/me');
  });

  // I/O matrix: mount, no existing session (/me -> 401) -> unauthenticated.
  it('transitions to "unauthenticated" when the mount-time /me call returns 401', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      problem: { title: 'Unauthorized' },
      networkError: false,
    });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  // I/O matrix: mount, valid existing session (/me -> 200) -> authenticated, user populated.
  it('transitions to "authenticated" with the user when the mount-time /me call returns 200', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: makeUser() });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
  });

  // I/O matrix: login submitted with valid credentials -> POST /login (200) then
  // GET /me re-check (200) to mint the XSRF-TOKEN cookie -> authenticated.
  it('login(): POSTs credentials then re-checks /me, transitioning to authenticated on success', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockResolvedValueOnce({ ok: true, status: 200, data: makeUser() }) // POST /api/auth/login
      .mockResolvedValueOnce({ ok: true, status: 200, data: makeUser() }); // re-check GET /api/auth/me

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    expect(screen.getByTestId('login-result')).toHaveTextContent('ok');

    expect(mockedApiFetch).toHaveBeenCalledTimes(3);
    expect(mockedApiFetch).toHaveBeenNthCalledWith(1, '/api/auth/me');
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockedApiFetch).toHaveBeenNthCalledWith(3, '/api/auth/me');
  });

  // I/O matrix: login submitted, invalid credentials (401) -> visible inline error,
  // auth state stays unauthenticated (form stays editable is LoginForm's concern).
  it('login(): resolves with the error message on invalid credentials and does not authenticate', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        problem: { title: 'Invalid credentials' },
        networkError: false,
      }); // POST /api/auth/login

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent('Invalid credentials');
    });
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
  });

  // I/O matrix: login submitted, network/5xx failure -> visible inline error,
  // auth state stays unauthenticated.
  it('login(): resolves with the error message on a network failure and does not authenticate', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockResolvedValueOnce({ ok: false, status: null, problem: null, networkError: true }); // POST /api/auth/login

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  // describeAuthError branch: no problem body at all (e.g. a 5xx with a
  // non-JSON body) -- falls back to a status-code message, not "undefined"
  // or a blank alert. Mirrors the equivalent coverage on ProductList's
  // sibling describeError, ported here since this is a separate copy.
  it('login(): falls back to a status-code message when a failure has no ProblemDetails body', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockResolvedValueOnce({ ok: false, status: 502, problem: null, networkError: false }); // POST /api/auth/login

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent('Request failed (status 502).');
    });
  });

  // Defensive shape guard (mirrors ProductList's Array.isArray guard): a 200
  // response whose body isn't actually a valid UserDto must not be trusted
  // as an authenticated session.
  it('treats a malformed 200 body from the mount-time /me call as unauthenticated', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: { id: 'not-a-number' } });

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  // Same guard, exercised via the mount effect's .catch() safety net --
  // apiFetch is documented to never reject, but if that contract were ever
  // violated, `status` must not get stuck on 'checking' forever.
  it('recovers to "unauthenticated" if the mount-time /me call unexpectedly rejects', async () => {
    mockedApiFetch.mockRejectedValue(new Error('unexpected'));

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });

  // Same safety net inside login(): an unexpected rejection must resolve as
  // a normal failure, not propagate as an unhandled rejection that leaves
  // the caller (LoginForm) waiting forever.
  it('login(): resolves with a failure message if apiFetch unexpectedly rejects', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockRejectedValueOnce(new Error('unexpected')); // POST /api/auth/login

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).not.toHaveTextContent('idle');
    });
    expect(screen.getByTestId('login-result')).toHaveTextContent('Unexpected error');
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  // Edge case not in the frozen matrix but implied by the design notes: Login
  // itself succeeds (credentials valid, access_token cookie set) but the
  // /me re-check that mints XSRF-TOKEN fails -- login() must not report
  // success without the CSRF cookie in place.
  it('login(): reports failure if /login succeeds but the /me re-check fails', async () => {
    const user = userEvent.setup();
    mockedApiFetch
      .mockResolvedValueOnce({ ok: false, status: 401, problem: null, networkError: false }) // mount /me
      .mockResolvedValueOnce({ ok: true, status: 200, data: makeUser() }) // POST /api/auth/login
      .mockResolvedValueOnce({ ok: false, status: null, problem: null, networkError: true }); // re-check /me fails

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await user.click(screen.getByRole('button', { name: 'trigger-login' }));

    await waitFor(() => {
      expect(screen.getByTestId('login-result')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });
});
