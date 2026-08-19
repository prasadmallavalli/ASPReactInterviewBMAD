import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LoginResult } from './AuthContext';
import { useAuth } from './AuthContext';
import LoginForm from './LoginForm';

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function mockLogin(login: (email: string, password: string) => Promise<LoginResult>) {
  mockedUseAuth.mockReturnValue({ status: 'unauthenticated', user: null, login });
}

describe('LoginForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // AC: submitting the form calls login() with the entered credentials.
  it('calls login() with the entered email and password on submit', async () => {
    const user = userEvent.setup();
    const login = vi.fn<(email: string, password: string) => Promise<LoginResult>>(
      async () => ({ ok: true }),
    );
    mockLogin(login);

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('user@example.com', 'secret123');
    });
  });

  // I/O matrix: login in flight -> loading state on the form, submit disabled.
  it('shows a loading state and disables the submit button while login() is in flight', async () => {
    const user = userEvent.setup();
    let resolveLogin!: (result: LoginResult) => void;
    const login = vi.fn<(email: string, password: string) => Promise<LoginResult>>(
      () =>
        new Promise<LoginResult>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    mockLogin(login);

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(login).toHaveBeenCalledTimes(1);

    // Re-entrant click while still pending must not fire a second call.
    await user.click(screen.getByRole('button', { name: /logging in/i }));
    expect(login).toHaveBeenCalledTimes(1);

    // On success LoginForm deliberately leaves its loading state alone --
    // in the real app AuthContext's status flips to 'authenticated' and App
    // unmounts LoginForm for ProductList, so there's nothing to reset here.
    resolveLogin({ ok: true });
    await waitFor(() => {
      expect(login).toHaveResolved();
    });
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
  });

  // I/O matrix: invalid credentials (401) -> visible inline error, form stays editable.
  it('shows a visible inline error on invalid credentials and leaves the form editable', async () => {
    const user = userEvent.setup();
    const login = vi.fn<(email: string, password: string) => Promise<LoginResult>>(async () => ({
      ok: false,
      message: 'Invalid credentials',
    }));
    mockLogin(login);

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
    expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
    expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
    expect(screen.getByLabelText(/password/i)).not.toBeDisabled();
  });

  // I/O matrix: network/5xx failure -> visible inline error, form stays editable.
  it('shows a visible inline error on a network/5xx failure and leaves the form editable', async () => {
    const user = userEvent.setup();
    const login = vi.fn<(email: string, password: string) => Promise<LoginResult>>(async () => ({
      ok: false,
      message: 'Network error -- could not reach the server. Check your connection and try again.',
    }));
    mockLogin(login);

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
  });

  // Resubmitting after a failed attempt clears the previous error and retries.
  it('clears the previous error and re-submits on a second attempt', async () => {
    const user = userEvent.setup();
    const login = vi
      .fn<(email: string, password: string) => Promise<LoginResult>>()
      .mockResolvedValueOnce({ ok: false, message: 'Invalid credentials' })
      .mockResolvedValueOnce({ ok: true });
    mockLogin(login);

    render(<LoginForm />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });

    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
