import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
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
});
