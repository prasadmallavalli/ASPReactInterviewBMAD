import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api/client';
import type { CategoryDto, ProductDto, UserDto } from './api/types';
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

  // Review fix: the actual onCreated -> refreshKey -> ProductList remount
  // wiring between CreateProductForm and App had zero coverage anywhere --
  // CreateProductForm.test.tsx only asserts a standalone onCreated mock was
  // called, never App's real handler. Renders the real, authenticated App,
  // submits the real CreateProductForm, and confirms /api/products (GET) is
  // fetched again afterward -- i.e. that App's refreshKey bump actually
  // forces ProductList to remount and refetch, not a mocked substitute.
  it('re-fetches the product list via App\'s real refreshKey wiring after a successful create', async () => {
    const user = userEvent.setup();
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const createdProduct: ProductDto = { id: 99, name: 'New Product', price: 9.99, categoryId: 1 };
    let productListFetchCount = 0;

    mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products') {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (method === 'POST') {
          return Promise.resolve({ ok: true, status: 201, data: createdProduct });
        }
        productListFetchCount += 1;
        // First GET (mount): empty catalog. Second GET (post-create remount): the new product.
        const data = productListFetchCount === 1 ? [] : [createdProduct];
        return Promise.resolve({ ok: true, status: 200, data });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    expect(productListFetchCount).toBe(1);

    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByText('New Product')).toBeInTheDocument();
    });
    expect(productListFetchCount).toBe(2);
  });
});
