import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { CategoryDto, ProductDto } from '../api/types';
import CreateProductForm from './CreateProductForm';

vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const categories: CategoryDto[] = [
  { id: 1, name: 'Widgets' },
  { id: 2, name: 'Gadgets' },
];

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return { id: 10, name: 'New Product', price: 9.99, categoryId: 1, ...overrides };
}

/** Renders with the categories fetch already resolved successfully. */
async function renderReady(onCreated: () => void = vi.fn()) {
  mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: categories });
  render(<CreateProductForm onCreated={onCreated} />);
  await waitFor(() => {
    expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
  });
}

describe('CreateProductForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // I/O matrix: categories fail to load on mount -> form shows a message, submit disabled.
  it('disables the form and shows a message when categories fail to load', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: null,
      problem: null,
      networkError: true,
    });

    render(<CreateProductForm onCreated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/categories');
  });

  // I/O matrix: categories fail to load (network/5xx path via a 500 response too).
  it('disables the form when categories fetch returns a 4xx/5xx', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      problem: { title: 'Server error' },
      networkError: false,
    });

    render(<CreateProductForm onCreated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
  });

  // I/O matrix: submission in flight -> loading state, inputs/button disabled, re-entrant guarded.
  it('shows a loading state and disables inputs while submitting, guarding re-entrant submits', async () => {
    const user = userEvent.setup();
    await renderReady();

    let resolveCreate!: (result: Awaited<ReturnType<typeof apiFetch>>) => void;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    expect(screen.getByRole('button', { name: /adding/i })).toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
    expect(screen.getByLabelText(/price/i)).toBeDisabled();
    expect(screen.getByLabelText(/category/i)).toBeDisabled();
    expect(mockedApiFetch).toHaveBeenCalledTimes(2); // categories + create

    // Re-entrant click while still pending must not fire a second create call.
    await user.click(screen.getByRole('button', { name: /adding/i }));
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);

    resolveCreate({ ok: true, status: 201, data: makeProduct() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add product/i })).not.toBeDisabled();
    });
  });

  // I/O matrix: valid submission -> 201, form resets, onCreated called (App.tsx remounts ProductList).
  it('resets the form and calls onCreated on a successful (201) submission', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    await renderReady(onCreated);

    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 201, data: makeProduct() });

    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.selectOptions(screen.getByLabelText(/category/i), '2');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/products',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Product', price: 9.99, categoryId: 2 }),
      }),
    );

    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByLabelText(/price/i)).toHaveValue(null);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // I/O matrix: invalid submission (Name/Price) -> 400 ValidationProblemDetails -> visible form-level error, form stays editable.
  it('shows a visible form-level error on a 400 validation failure and preserves entered values', async () => {
    const user = userEvent.setup();
    await renderReady();

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      problem: { title: 'One or more validation errors occurred.' },
      networkError: false,
    });

    await user.type(screen.getByLabelText(/name/i), 'Bad Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('One or more validation errors occurred.');
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue('Bad Product');
    expect(screen.getByLabelText(/price/i)).toHaveValue(9.99);
    expect(screen.getByRole('button', { name: /add product/i })).not.toBeDisabled();
    expect(screen.getByLabelText(/name/i)).not.toBeDisabled();
  });

  // I/O matrix: invalid submission, bad CategoryId -> 400 Problem (CategoryNotFound) -> visible form-level error, form stays editable.
  it('shows a visible form-level error on a 400 CategoryNotFound failure and preserves entered values', async () => {
    const user = userEvent.setup();
    await renderReady();

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      problem: { title: 'Invalid category', detail: 'Category 99 does not exist.' },
      networkError: false,
    });

    await user.type(screen.getByLabelText(/name/i), 'Some Product');
    await user.type(screen.getByLabelText(/price/i), '5.00');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid category: Category 99 does not exist.');
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue('Some Product');
    expect(screen.getByRole('button', { name: /add product/i })).not.toBeDisabled();
  });

  // I/O matrix: network/5xx failure -> apiFetch returns ApiFailure -> visible form-level error, form stays editable.
  it('shows a visible form-level error on a network failure and preserves entered values', async () => {
    const user = userEvent.setup();
    await renderReady();

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: null,
      problem: null,
      networkError: true,
    });

    await user.type(screen.getByLabelText(/name/i), 'Offline Product');
    await user.type(screen.getByLabelText(/price/i), '3.50');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue('Offline Product');
    expect(screen.getByRole('button', { name: /add product/i })).not.toBeDisabled();
  });

  // Review fix: an unexpected apiFetch rejection during the create call must
  // not leave the button stuck on "Adding…" forever with no visible error.
  it('recovers from an unexpected apiFetch rejection on submit with a visible error', async () => {
    const user = userEvent.setup();
    await renderReady();

    mockedApiFetch.mockRejectedValueOnce(new Error('boom'));

    await user.type(screen.getByLabelText(/name/i), 'Rejected Product');
    await user.type(screen.getByLabelText(/price/i), '4.00');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unexpected error/i);
    });
    expect(screen.getByRole('button', { name: /add product/i })).not.toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toHaveValue('Rejected Product');
  });

  // Review fix: an all-whitespace Name passes native `required` but must be
  // rejected client-side rather than silently trimmed to '' and submitted.
  it('shows a form-level error and does not submit when Name is all whitespace', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/name/i), '   ');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Only the categories fetch happened -- no create POST was issued.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  // Review fix: `apiFetch` never validates the shape of `GET /api/categories`
  // at runtime (same defensive posture as ProductList's Array.isArray
  // guard) -- a malformed category (non-numeric `id`) must not be silently
  // serialized as `categoryId: NaN` in the create request. Name/Price
  // reaching the handler as valid values (native `required`/`min` already
  // satisfied) isolates this to the CategoryId half of the guard.
  it('shows a form-level error and does not submit when the selected category has a malformed id', async () => {
    const user = userEvent.setup();
    // Deliberately malformed to simulate an untrusted/unvalidated API
    // response -- CategoryDto declares `id: number`, but apiFetch only
    // casts the parsed JSON, never validates it at runtime.
    const malformedCategories = [
      { id: 'not-a-number', name: 'Bad Category' },
    ] as unknown as CategoryDto[];
    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: malformedCategories });
    render(<CreateProductForm onCreated={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
    });

    await user.type(screen.getByLabelText(/name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Only the categories fetch happened -- no create POST was issued.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  // I/O matrix / review fix: categories load successfully but with zero
  // entries -> treated like the fetch-failure case (disabled form, visible
  // message) rather than a silently unsubmittable empty dropdown.
  it('disables the form and shows a message when the category list is empty', async () => {
    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: [] });

    render(<CreateProductForm onCreated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no categories exist/i);
    });
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/category/i)).not.toBeInTheDocument();
  });
});
