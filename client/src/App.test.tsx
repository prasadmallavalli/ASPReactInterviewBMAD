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

  // Review fix: the actual onSaved -> refreshKey -> ProductList remount
  // wiring between ProductForm and App had zero coverage anywhere --
  // ProductForm.test.tsx only asserts a standalone onSaved mock was called,
  // never App's real handler. Renders the real, authenticated App, submits
  // the real ProductForm (create mode), and confirms /api/products (GET) is
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

  // Story 3.4: the onEdit -> editingProduct -> ProductForm(edit) -> onSaved ->
  // refreshKey -> ProductList remount wiring, exercised end-to-end through
  // the real App (no mocked ProductForm/ProductList substitutes) -- mirrors
  // the create->refresh integration test above but for the edit path.
  it("re-fetches the product list via App's real refreshKey wiring after a successful edit", async () => {
    const user = userEvent.setup();
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const existingProduct: ProductDto = { id: 42, name: 'Old Name', price: 5, categoryId: 1 };
    const updatedProduct: ProductDto = { ...existingProduct, name: 'New Name', price: 15 };
    let productListFetchCount = 0;

    mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products/42') {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (method === 'PUT') {
          return Promise.resolve({ ok: true, status: 200, data: updatedProduct });
        }
      }
      if (path === '/api/products') {
        productListFetchCount += 1;
        // First GET (mount): the original product. Second GET (post-edit
        // remount): the updated product.
        const data = productListFetchCount === 1 ? [existingProduct] : [updatedProduct];
        return Promise.resolve({ ok: true, status: 200, data });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });
    expect(productListFetchCount).toBe(1);

    await user.click(screen.getByRole('button', { name: /edit/i }));

    // ProductForm switches to edit mode, pre-filled from the selected product.
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Old Name');
    });

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'New Name');
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '15');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });
    expect(productListFetchCount).toBe(2);
    // Back to create mode: the Add Product button is showing again, not Save/Cancel.
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });

  // I/O matrix: Cancel clicked in edit mode -> returns to create mode; no API call issued for the cancel itself.
  it('returns to create mode with no API call when Cancel is clicked in edit mode', async () => {
    const user = userEvent.setup();
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const existingProduct: ProductDto = { id: 42, name: 'Old Name', price: 5, categoryId: 1 };

    mockedApiFetch.mockImplementation((path: unknown) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products') {
        return Promise.resolve({ ok: true, status: 200, data: [existingProduct] });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Old Name');
    });

    const callsBeforeCancel = mockedApiFetch.mock.calls.length;

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    expect(mockedApiFetch.mock.calls.length).toBe(callsBeforeCancel);
  });

  // Retro fix (Epic 3, Finding A): App's real editingProduct state must
  // actually reach ProductList as busyProductId -- ProductList.test.tsx
  // covers the prop's own behavior in isolation, this proves App wires it
  // through for real. Opening a row in the edit form disables that row's
  // own Delete button (closing the "delete the row I'm editing" race);
  // returning to create mode (via Cancel) re-enables it.
  it("disables a row's Delete button while it's open in the edit form, via App's real wiring", async () => {
    const user = userEvent.setup();
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const existingProduct: ProductDto = { id: 42, name: 'Old Name', price: 5, categoryId: 1 };

    mockedApiFetch.mockImplementation((path: unknown) => {
      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products') {
        return Promise.resolve({ ok: true, status: 200, data: [existingProduct] });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Old Name')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /edit/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
    });
  });

  // Retro fix (Epic 3, Finding D): the composed login -> app UI transition
  // was never exercised by any automated test -- every other scenario here
  // mocks /api/auth/me as already-200 at mount, LoginForm.test.tsx mocks
  // useAuth() entirely, and AuthContext.test.tsx only drives login() through
  // a standalone probe, never the real LoginForm. This starts genuinely
  // unauthenticated, submits the real LoginForm, lets AuthContext's real
  // two-step login() (POST /api/auth/login, then a /me re-check for the
  // XSRF-TOKEN cookie) run, confirms AuthGate swaps the login form out for
  // the product views, then continues into the same create -> edit -> delete
  // cycle the fully-authenticated test below covers -- proving the seam
  // between Epic 2's auth and Epic 3's product UI holds under the sequence
  // that actually follows it in the real app, not just in isolation.
  it('logs in through the real LoginForm/AuthContext flow, then completes create -> edit -> delete', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const createdProduct: ProductDto = { id: 99, name: 'New Product', price: 9.99, categoryId: 1 };
    const updatedProduct: ProductDto = { ...createdProduct, name: 'Updated Product', price: 15 };
    let meCallCount = 0;
    let productListFetchCount = 0;

    mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();

      if (path === '/api/auth/login' && method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/auth/me') {
        meCallCount += 1;
        // 1st (mount): no session yet -> login form. 2nd (post-login
        // re-check, minting XSRF-TOKEN): now authenticated.
        if (meCallCount === 1) {
          return Promise.resolve({ ok: false, status: 401, problem: null, networkError: false });
        }
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products' && method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, data: createdProduct });
      }
      if (path === '/api/products/99' && method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, data: updatedProduct });
      }
      if (path === '/api/products/99' && method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, data: undefined });
      }
      if (path === '/api/products') {
        productListFetchCount += 1;
        const data =
          productListFetchCount === 1
            ? []
            : productListFetchCount === 2
              ? [createdProduct]
              : productListFetchCount === 3
                ? [updatedProduct]
                : [];
        return Promise.resolve({ ok: true, status: 200, data });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    // Real login, through the real LoginForm + AuthContext.login().
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'correct-password');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // AuthGate swaps the login form out for the product views once
    // AuthContext's two-step login() flow (login POST + /me re-check) both
    // resolve -- no mocked substitute for either.
    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(meCallCount).toBe(2);

    // Create.
    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByText('New Product')).toBeInTheDocument();
    });

    // Edit.
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('New Product');
    });
    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Updated Product');
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '15');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText('Updated Product')).toBeInTheDocument();
    });

    // Delete.
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(window.confirm).toHaveBeenCalledWith('Delete "Updated Product"?');
    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Updated Product')).not.toBeInTheDocument();

    // The session was only ever checked twice across the whole flow (mount
    // + the one post-login re-check) -- no extra /me calls snuck in during
    // the create/edit/delete cycle.
    expect(meCallCount).toBe(2);
  });

  // Story 3.5 AC: the full create -> list -> edit -> delete cycle, exercised
  // end-to-end through the real App (no mocked ProductForm/ProductList/
  // AuthProvider substitutes) -- confirms no page reload (auth is only
  // checked once, at initial mount) and auth state stays intact throughout.
  it('completes a full create -> edit -> delete cycle with no page reload and auth preserved', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const category: CategoryDto = { id: 1, name: 'Widgets' };
    const createdProduct: ProductDto = { id: 99, name: 'New Product', price: 9.99, categoryId: 1 };
    const updatedProduct: ProductDto = { ...createdProduct, name: 'Updated Product', price: 15 };
    let productListFetchCount = 0;

    mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
      const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();

      if (path === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, data: makeUser() });
      }
      if (path === '/api/categories') {
        return Promise.resolve({ ok: true, status: 200, data: [category] });
      }
      if (path === '/api/products' && method === 'POST') {
        return Promise.resolve({ ok: true, status: 201, data: createdProduct });
      }
      if (path === '/api/products/99' && method === 'PUT') {
        return Promise.resolve({ ok: true, status: 200, data: updatedProduct });
      }
      if (path === '/api/products/99' && method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, data: undefined });
      }
      if (path === '/api/products') {
        productListFetchCount += 1;
        // 1st (mount): empty. 2nd (post-create remount): the created
        // product. 3rd (post-edit remount): the updated product. 4th
        // (post-delete, ProductList's own fetchProducts): empty again.
        const data =
          productListFetchCount === 1
            ? []
            : productListFetchCount === 2
              ? [createdProduct]
              : productListFetchCount === 3
                ? [updatedProduct]
                : [];
        return Promise.resolve({ ok: true, status: 200, data });
      }
      return Promise.resolve({ ok: false, status: 404, problem: null, networkError: false });
    });

    render(<App />);

    // Create.
    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByText('New Product')).toBeInTheDocument();
    });

    // Edit.
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('New Product');
    });
    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Updated Product');
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '15');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText('Updated Product')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();

    // Delete.
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(window.confirm).toHaveBeenCalledWith('Delete "Updated Product"?');
    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Updated Product')).not.toBeInTheDocument();

    // No page reload occurred: the mount-time session check ran exactly
    // once across the whole create/edit/delete cycle -- a reload would have
    // remounted AuthProvider and re-triggered it. Auth state (still on the
    // authenticated ProductForm/ProductList view, not the login form) held
    // throughout.
    const authChecks = mockedApiFetch.mock.calls.filter(([path]) => path === '/api/auth/me');
    expect(authChecks).toHaveLength(1);
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /log in/i })).not.toBeInTheDocument();
  });
});
