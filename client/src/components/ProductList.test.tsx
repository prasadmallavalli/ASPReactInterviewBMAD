import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { ApiResult } from '../api/client';
import type { ProductDto } from '../api/types';
import ProductList from './ProductList';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return { id: 1, name: 'Widget', price: 9.99, categoryId: 3, ...overrides };
}

describe('ProductList', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // I/O matrix: fetch in flight -> loading indicator shown.
  it('shows a loading indicator while the fetch is in flight', () => {
    mockedApiFetch.mockReturnValue(new Promise(() => {})); // never resolves

    render(<ProductList />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  // I/O matrix: fetch succeeds, products exist -> Name and Price visible for every product.
  it('renders every product Name and Price once the fetch succeeds', async () => {
    const products = [
      makeProduct({ id: 1, name: 'Widget', price: 9.99, categoryId: 3 }),
      makeProduct({ id: 2, name: 'Gadget', price: 19.5, categoryId: 7 }),
    ];
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: products });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('Gadget')).toBeInTheDocument();
    expect(screen.getByText('$19.50')).toBeInTheDocument();
    // CategoryId shown as the raw id, no name resolution.
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/products');
  });

  // I/O matrix: fetch succeeds, empty catalog -> explicit empty-state message, never a blank screen.
  it('renders an explicit empty-state message for an empty catalog', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: [] });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText(/no products/i)).toBeInTheDocument();
    });
  });

  // I/O matrix: network error -> visible error message + Retry button.
  it('shows a visible error message and a Retry button on a network error', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: null,
      problem: null,
      networkError: true,
    });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // I/O matrix: 4xx/5xx failure -> visible error message using problem.title/detail, plus Retry.
  it('shows problem.title and detail when a 4xx/5xx failure includes ProblemDetails', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      problem: { title: 'Server error', detail: 'Something went wrong.' },
      networkError: false,
    });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error: Something went wrong.');
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // describeError branch: no problem body at all (e.g. a 5xx with a non-JSON
  // body) -- falls back to a status-code message, not "undefined" or a blank alert.
  it('falls back to a status-code message when a failure has no ProblemDetails body', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 502,
      problem: null,
      networkError: false,
    });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Request failed (status 502).');
    });
  });

  // describeError branch: problem.title present but no detail -- renders just
  // the title, with no stray ": " separator or literal "undefined" tail.
  it('renders only problem.title when detail is absent, with no stray separator', async () => {
    mockedApiFetch.mockResolvedValue({
      ok: false,
      status: 500,
      problem: { title: 'Server error' },
      networkError: false,
    });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Server error');
    });
    expect(screen.getByRole('alert').textContent).not.toMatch(/undefined/);
    expect(screen.getByRole('alert').textContent).not.toContain('Server error:');
  });

  // AC: clicking Retry issues a new apiFetch call (same request re-issued).
  it('re-issues the fetch when Retry is clicked, and recovers on success', async () => {
    const user = userEvent.setup();
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      problem: { title: 'Server error' },
      networkError: false,
    });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);

    const products = [makeProduct()];
    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: products });

    await user.click(screen.getByRole('button', { name: /retry/i }));

    expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    expect(mockedApiFetch).toHaveBeenNthCalledWith(2, '/api/products');
    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });
  });

  // Story 3.4: no onEdit prop -> no Edit button/Actions column rendered at all.
  it('renders no Edit button when onEdit is not provided', async () => {
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: [makeProduct()] });

    render(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  // Story 3.4: an Edit button per row, invoking onEdit with that row's exact product.
  it('invokes onEdit with the clicked row\'s product when its Edit button is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const products = [
      makeProduct({ id: 1, name: 'Widget', price: 9.99, categoryId: 3 }),
      makeProduct({ id: 2, name: 'Gadget', price: 19.5, categoryId: 7 }),
    ];
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: products });

    render(<ProductList onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Gadget')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons).toHaveLength(2);

    await user.click(editButtons[1]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(products[1]);
  });

  // Retro fix (Epic 3, Finding A): the row identified by `busyProductId`
  // (App.tsx's editingProduct) is the one currently open in the edit form --
  // its Delete must be disabled for as long as that's true, not just while a
  // save is in flight, closing the "delete the row I'm editing" race.
  // Other rows, and this row's own Edit button, stay interactive.
  it('disables only the busyProductId row\'s Delete button, leaving Edit and other rows interactive', async () => {
    const products = [
      makeProduct({ id: 1, name: 'Widget' }),
      makeProduct({ id: 2, name: 'Gadget' }),
    ];
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: products });

    render(<ProductList onEdit={vi.fn()} busyProductId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Gadget')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
    const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
    expect(deleteButtons[0]).toBeDisabled();
    expect(editButtons[0]).not.toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();
    expect(editButtons[1]).not.toBeDisabled();
  });

  // Retro fix (Finding A): no busyProductId (or null, App.tsx's "not
  // editing" value) -> every row's Delete stays interactive as before.
  it('leaves every row\'s Delete button enabled when busyProductId is null/omitted', async () => {
    const products = [makeProduct({ id: 1, name: 'Widget' })];
    mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: products });

    render(<ProductList onEdit={vi.fn()} busyProductId={null} />);

    await waitFor(() => {
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
  });

  // Story 3.5 I/O matrix: Delete clicked + confirmed -> DELETE fires via
  // apiFetch, and on 204 the list is refreshed via fetchProducts (item disappears).
  describe('delete', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('issues DELETE and refetches the list when Delete is clicked and confirmed', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const products = [makeProduct({ id: 1, name: 'Widget' })];

      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return Promise.resolve({ ok: true, status: 204, data: undefined });
        }
        return Promise.resolve({ ok: true, status: 200, data: products });
      });

      render(<ProductList />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      // Once DELETE resolves, the refetch reports an empty catalog.
      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return Promise.resolve({ ok: true, status: 204, data: undefined });
        }
        return Promise.resolve({ ok: true, status: 200, data: [] });
      });

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(window.confirm).toHaveBeenCalledWith('Delete "Widget"?');
      expect(mockedApiFetch).toHaveBeenCalledWith('/api/products/1', { method: 'DELETE' });

      await waitFor(() => {
        expect(screen.getByText(/no products/i)).toBeInTheDocument();
      });
    });

    // I/O matrix: Delete clicked + cancelled -> no API call, item remains.
    it('issues no API call and leaves the item in place when Delete is clicked and cancelled', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const products = [makeProduct({ id: 1, name: 'Widget' })];
      mockedApiFetch.mockResolvedValue({ ok: true, status: 200, data: products });

      render(<ProductList />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      const callsBeforeDelete = mockedApiFetch.mock.calls.length;
      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(window.confirm).toHaveBeenCalled();
      expect(mockedApiFetch.mock.calls.length).toBe(callsBeforeDelete);
      expect(screen.getByText('Widget')).toBeInTheDocument();
    });

    // I/O matrix: delete in flight -> that row's Delete button disabled
    // (loading); other rows' Edit/Delete stay interactive (concurrent
    // deletes of different products are independent). Retro fix (Finding A):
    // the deleting row's own Edit button is now also disabled -- clicking
    // Edit on a row whose delete just succeeded used to show a form for a
    // product that no longer exists.
    it("disables the deleting row's Edit and Delete buttons while its request is in flight, leaving other rows interactive", async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const products = [
        makeProduct({ id: 1, name: 'Widget' }),
        makeProduct({ id: 2, name: 'Gadget' }),
      ];

      let resolveDelete: (value: ApiResult<unknown>) => void = () => {};
      // Tracks whether the pending DELETE has been resolved yet, so the mock's
      // GET branch reflects real server behavior: the deleted product is only
      // absent from the list *after* the delete has actually completed.
      let deleted = false;
      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return new Promise<ApiResult<unknown>>((resolve) => {
            resolveDelete = (value) => {
              deleted = true;
              resolve(value);
            };
          });
        }
        const data = deleted ? products.filter((product) => product.id !== 1) : products;
        return Promise.resolve({ ok: true, status: 200, data });
      });

      render(<ProductList onEdit={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /^delete$/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
      });

      // The deleting row's own Edit is disabled too; the other row's Edit/Delete remain interactive.
      const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
      expect(editButtons[0]).toBeDisabled();
      expect(editButtons[1]).not.toBeDisabled();
      expect(deleteButtons[1]).not.toBeDisabled();

      resolveDelete({ ok: true, status: 204, data: undefined });

      // The deleted row (and its disabled "Deleting…" button) disappears
      // entirely once the post-delete refetch resolves -- deletingIds is
      // deliberately never cleared on the success path, so the only way this
      // button goes away is via the row itself being removed from the list.
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /deleting/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Widget')).not.toBeInTheDocument();
      expect(screen.getByText('Gadget')).toBeInTheDocument();
    });

    // Review fix: a second click on the *same* row's Delete button before
    // the first DELETE resolves (and before React has re-rendered the
    // now-disabled button) must not fire a second request -- this is the
    // exact race the deletingIdsRef re-entrancy guard exists to close.
    it('fires only one DELETE for a row double-clicked before its request resolves', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const products = [makeProduct({ id: 1, name: 'Widget' })];

      let resolveDelete: (value: ApiResult<unknown>) => void = () => {};
      let deleted = false;
      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return new Promise<ApiResult<unknown>>((resolve) => {
            resolveDelete = (value) => {
              deleted = true;
              resolve(value);
            };
          });
        }
        return Promise.resolve({ ok: true, status: 200, data: deleted ? [] : products });
      });

      render(<ProductList />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /^delete$/i });
      // Two clicks dispatched before the first DELETE resolves (and thus
      // before React re-renders the button as disabled) -- both go through
      // the same synchronous handler, so the ref-backed guard (not just the
      // `disabled` attribute) is what has to reject the second one.
      await user.click(deleteButton);
      await user.click(deleteButton);

      const deleteCalls = mockedApiFetch.mock.calls.filter(
        ([path, init]) =>
          path === '/api/products/1' &&
          ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase() === 'DELETE',
      );
      expect(deleteCalls).toHaveLength(1);
      expect(window.confirm).toHaveBeenCalledTimes(1);

      resolveDelete({ ok: true, status: 204, data: undefined });
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /deleting/i })).not.toBeInTheDocument();
      });
    });

    // I/O matrix: delete fails (404 or ApiFailure) -> visible error message,
    // item remains in the list.
    it('shows a visible delete error and keeps the item in the list when DELETE fails', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const products = [makeProduct({ id: 1, name: 'Widget' })];

      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 404,
            problem: { title: 'Not found' },
            networkError: false,
          });
        }
        return Promise.resolve({ ok: true, status: 200, data: products });
      });

      render(<ProductList />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Not found');
      });
      // Item stays in the list -- the delete failure does not replace it
      // with the full-list error branch.
      expect(screen.getByText('Widget')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
    });

    // Retro fix (Epic 3, Finding B): App.tsx used to pass this value as
    // ProductList's `key`, forcing a full remount (and resetting
    // deletingIds) on every unrelated Create/Edit success. A remount mid-
    // delete would silently drop this row's own pending-delete state, so it
    // reappeared fully interactive even though its DELETE was still
    // outstanding server-side. `refreshSignal` is a plain prop instead: the
    // same persistent instance (no `key` change, mirroring how App.tsx
    // actually re-renders it) refetches without unmounting, so deletingIds
    // survives.
    it('keeps an in-flight delete disabled across a refreshSignal-triggered refetch (no remount)', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const products = [
        makeProduct({ id: 1, name: 'Widget' }),
        makeProduct({ id: 2, name: 'Gadget' }),
      ];

      let resolveDelete: (value: ApiResult<unknown>) => void = () => {};
      let deleted = false;
      mockedApiFetch.mockImplementation((path: unknown, init?: unknown) => {
        const method = ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase();
        if (path === '/api/products/1' && method === 'DELETE') {
          return new Promise<ApiResult<unknown>>((resolve) => {
            resolveDelete = (value) => {
              deleted = true;
              resolve(value);
            };
          });
        }
        const data = deleted ? products.filter((product) => product.id !== 1) : products;
        return Promise.resolve({ ok: true, status: 200, data });
      });

      const { rerender } = render(<ProductList refreshSignal={0} />);

      await waitFor(() => {
        expect(screen.getByText('Widget')).toBeInTheDocument();
      });

      await user.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();
      });

      // Simulate App.tsx bumping refreshKey after an unrelated Create/Edit
      // success -- same persistent instance, no `key` change.
      rerender(<ProductList refreshSignal={1} />);

      // The refetch re-resolves both rows unchanged; Widget's delete must
      // still show as in flight, not reset to interactive.
      await waitFor(() => {
        expect(screen.getByText('Gadget')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled();

      // The original DELETE now resolves -- still wired to the same request,
      // proving deletingIdsRef truly survived the refetch rather than a new
      // instance coincidentally reaching the same visual state.
      resolveDelete({ ok: true, status: 204, data: undefined });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /deleting/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByText('Widget')).not.toBeInTheDocument();
      expect(screen.getByText('Gadget')).toBeInTheDocument();
    });
  });
});
