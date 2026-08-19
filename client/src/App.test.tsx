import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api/client';
import type { UserDto } from './api/types';
import App from './App';

vi.mock('./api/client', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function makeUser(): UserDto {
  return { id: 1, email: 'user@example.com' };
}

/**
 * Covers `App.tsx`'s `AuthGate` -- the routing logic mapping AuthContext's
 * three statuses to the checking indicator / LoginForm / ProductList, which
 * had zero test coverage: `AuthContext.test.tsx` only exercises context
 * state via a standalone probe, and `LoginForm.test.tsx`/`ProductList.test.tsx`
 * render those components directly, bypassing the gate entirely.
 */
describe('App / AuthGate', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // I/O matrix: session check in flight -> checking indicator, neither login form nor ProductList.
  it('shows a checking indicator while the mount-time session check is pending', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(/checking/i);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no products/i)).not.toBeInTheDocument();
  });

  // I/O matrix: app mount, no existing session (/me -> 401) -> login form shown.
  it('shows the login form when there is no existing session', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 401,
      problem: null,
      networkError: false,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  // I/O matrix: app mount, valid existing session (/me -> 200) -> ProductList
  // rendered directly, login form skipped.
  it('shows ProductList directly when a valid session already exists', async () => {
    mockedApiFetch.mockImplementation((path: unknown) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/products') {
        return Promise.resolve({ ok: true, status: 200, data: [] });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
  });
});
