import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/client';
import type { CategoryDto, ProductDto } from '../api/types';
import ProductForm from './ProductForm';

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

/** Renders create mode with the categories fetch already resolved successfully. */
async function renderReady(onSaved: () => void = vi.fn()) {
  mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: categories });
  render(<ProductForm mode="create" onSaved={onSaved} />);
  await waitFor(() => {
    expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
  });
}

/** Renders edit mode, pre-filled from `initialProduct`, with the categories fetch already resolved successfully. */
async function renderEditReady(
  initialProduct: ProductDto,
  handlers: { onSaved?: () => void; onCancel?: () => void } = {},
) {
  mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: categories });
  render(
    <ProductForm
      mode="edit"
      initialProduct={initialProduct}
      onSaved={handlers.onSaved ?? vi.fn()}
      onCancel={handlers.onCancel ?? vi.fn()}
    />,
  );
  await waitFor(() => {
    expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
  });
}

describe('ProductForm (create mode)', () => {
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

    render(<ProductForm mode="create" onSaved={vi.fn()} />);

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

    render(<ProductForm mode="create" onSaved={vi.fn()} />);

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

  // I/O matrix: valid submission -> 201, form resets, onSaved called (App.tsx remounts ProductList).
  it('resets the form and calls onSaved on a successful (201) submission', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    await renderReady(onSaved);

    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 201, data: makeProduct() });

    await user.type(screen.getByLabelText(/name/i), 'New Product');
    await user.type(screen.getByLabelText(/price/i), '9.99');
    await user.selectOptions(screen.getByLabelText(/category/i), '2');
    await user.click(screen.getByRole('button', { name: /add product/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
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
    render(<ProductForm mode="create" onSaved={vi.fn()} />);
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

    render(<ProductForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/no categories exist/i);
    });
    expect(screen.queryByRole('button', { name: /add product/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/category/i)).not.toBeInTheDocument();
  });
});

describe('ProductForm (edit mode)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // I/O matrix: Edit clicked on a row -> ProductForm switches to edit mode, pre-filled with that product's values.
  it('pre-fills Name/Price/Category from initialProduct', async () => {
    const product = makeProduct({ id: 5, name: 'Existing Widget', price: 12.5, categoryId: 2 });
    await renderEditReady(product);

    expect(screen.getByLabelText(/name/i)).toHaveValue('Existing Widget');
    expect(screen.getByLabelText(/price/i)).toHaveValue(12.5);
    expect(screen.getByLabelText(/category/i)).toHaveValue('2');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // I/O matrix: Cancel clicked in edit mode -> returns to create mode; no API call.
  it('calls onCancel and issues no API call when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const product = makeProduct({ id: 5, name: 'Existing Widget', price: 12.5, categoryId: 2 });
    await renderEditReady(product, { onCancel });

    // Only the categories fetch happened so far.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    // Cancel must not issue any additional API call.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  // I/O matrix: Edit in flight -> loading state; inputs/button disabled.
  it('shows a loading state and disables inputs/Cancel while an edit submit is in flight', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 5, name: 'Existing Widget', price: 12.5, categoryId: 2 });
    await renderEditReady(product);

    let resolveUpdate!: (result: Awaited<ReturnType<typeof apiFetch>>) => void;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(mockedApiFetch).toHaveBeenCalledTimes(2); // categories + PUT

    resolveUpdate({ ok: true, status: 200, data: { ...product, name: 'Existing Widget' } });
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledTimes(2);
    });
  });

  // I/O matrix: valid edit submitted -> PUT /api/products/{id} -> 200 -> onSaved called.
  it('submits PUT /api/products/{id} with edited values and calls onSaved on success', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const product = makeProduct({ id: 7, name: 'Old Name', price: 5, categoryId: 1 });
    await renderEditReady(product, { onSaved });

    mockedApiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: { ...product, name: 'Updated Name', price: 15 },
    });

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Updated Name');
    await user.clear(screen.getByLabelText(/price/i));
    await user.type(screen.getByLabelText(/price/i), '15');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });

    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/products/7',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name', price: 15, categoryId: 1 }),
      }),
    );
  });

  // I/O matrix: invalid edit or failure -> visible form-level error; stays in edit mode, values preserved.
  it('shows a visible form-level error on a 400 validation failure and stays in edit mode with values preserved', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const product = makeProduct({ id: 7, name: 'Old Name', price: 5, categoryId: 1 });
    await renderEditReady(product, { onSaved });

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      problem: { title: 'One or more validation errors occurred.' },
      networkError: false,
    });

    await user.clear(screen.getByLabelText(/name/i));
    await user.type(screen.getByLabelText(/name/i), 'Bad Update');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('One or more validation errors occurred.');
    });
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/name/i)).toHaveValue('Bad Update');
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
    // Still in edit mode: Save/Cancel labels, not the create-mode button.
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // I/O matrix: invalid edit -> 404 (product deleted elsewhere / bad id) -> visible form-level error, stays in edit mode.
  it('shows a visible form-level error on a 404 and stays in edit mode', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 7, name: 'Old Name', price: 5, categoryId: 1 });
    await renderEditReady(product);

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      problem: null,
      networkError: false,
    });

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Request failed (status 404).');
    });
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // I/O matrix: invalid edit, bad CategoryId -> 400 Problem (CategoryNotFound) -> visible form-level error, stays in edit mode.
  it('shows a visible form-level error on a 400 CategoryNotFound failure', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 7, name: 'Old Name', price: 5, categoryId: 1 });
    await renderEditReady(product);

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      problem: { title: 'Invalid category', detail: 'Category 99 does not exist.' },
      networkError: false,
    });

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid category: Category 99 does not exist.');
    });
  });

  // I/O matrix: edit failure -> network error -> visible form-level error, stays in edit mode.
  it('shows a visible form-level error on a network failure during edit submit', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 7, name: 'Old Name', price: 5, categoryId: 1 });
    await renderEditReady(product);

    mockedApiFetch.mockResolvedValueOnce({
      ok: false,
      status: null,
      problem: null,
      networkError: true,
    });

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/network error/i);
    });
    expect(screen.getByLabelText(/name/i)).toHaveValue('Old Name');
  });

  // Code review fix: handleSubmit's closure previously captured mode/
  // initialProduct at call time with no staleness check -- if a stale PUT
  // response for a previously-edited product arrived after the user had
  // already switched to editing a *different* product, its success handler
  // would still unconditionally fire onSaved, silently bouncing the user out
  // of their in-progress edit of the new product back to create mode. This
  // reproduces that exact sequence: Edit A -> Save (pending) -> switch to
  // editing B (as App.tsx would via a prop change, no remount) before A's
  // PUT resolves -> A's stale success must be ignored entirely.
  it('ignores a stale PUT response for a previous edit target after switching to a different one', async () => {
    const user = userEvent.setup();
    const productA = makeProduct({ id: 1, name: 'Product A', price: 10, categoryId: 1 });
    const productB = makeProduct({ id: 2, name: 'Product B', price: 20, categoryId: 2 });
    const onSavedA = vi.fn();
    const onCancelA = vi.fn();

    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: categories });
    const { rerender } = render(
      <ProductForm mode="edit" initialProduct={productA} onSaved={onSavedA} onCancel={onCancelA} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
    });

    let resolveA!: (result: Awaited<ReturnType<typeof apiFetch>>) => void;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveA = resolve;
      }),
    );

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockedApiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/products/1',
      expect.objectContaining({ method: 'PUT' }),
    );

    // Switch to editing product B before A's PUT resolves -- App.tsx does
    // this by re-rendering the same persistent ProductForm instance with new
    // props (no key change) when Edit is clicked on a different row.
    const onSavedB = vi.fn();
    const onCancelB = vi.fn();
    rerender(
      <ProductForm mode="edit" initialProduct={productB} onSaved={onSavedB} onCancel={onCancelB} />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/name/i)).toHaveValue('Product B');
    });
    // No categories re-fetch, no new PUT -- switching targets issues no API call.
    expect(mockedApiFetch).toHaveBeenCalledTimes(2);

    // A's stale PUT now resolves successfully.
    await act(async () => {
      resolveA({ ok: true, status: 200, data: { ...productA, name: 'Updated A' } });
      // Flush the microtask queue so handleSubmit's post-await continuation runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    // Still showing B's data, still in edit mode for B -- A's stale success
    // must not have called onSavedA, nor touched B's onSaved/onCancel.
    expect(screen.getByLabelText(/name/i)).toHaveValue('Product B');
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(onSavedA).not.toHaveBeenCalled();
    expect(onSavedB).not.toHaveBeenCalled();
    expect(onCancelA).not.toHaveBeenCalled();
    expect(onCancelB).not.toHaveBeenCalled();
    // No error shown either -- the stale response is silently dropped, not surfaced as a failure.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // Code review fix: same staleness guard, but for the "switch back to
  // create mode via Cancel while a PUT is pending" path -- a stale success
  // arriving after Cancel must not resurrect the just-cancelled edit or
  // otherwise disturb the now-create-mode form.
  it('ignores a stale PUT response after switching back to create mode before it resolves', async () => {
    const user = userEvent.setup();
    const product = makeProduct({ id: 1, name: 'Product A', price: 10, categoryId: 1 });
    const onSaved = vi.fn();
    const onCancel = vi.fn();

    mockedApiFetch.mockResolvedValueOnce({ ok: true, status: 200, data: categories });
    const { rerender } = render(
      <ProductForm mode="edit" initialProduct={product} onSaved={onSaved} onCancel={onCancel} />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/category/i)).not.toBeDisabled();
    });

    let resolvePut!: (result: Awaited<ReturnType<typeof apiFetch>>) => void;
    mockedApiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePut = resolve;
      }),
    );

    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();

    // Switch the same persistent instance back to create mode before the PUT
    // resolves -- the same prop change App.tsx's real Cancel/onSaved handler
    // produces (no key, so no remount).
    rerender(<ProductForm mode="create" onSaved={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    });

    await act(async () => {
      resolvePut({ ok: true, status: 200, data: { ...product, name: 'Updated' } });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Still in create mode, blank -- the stale success must not have called
    // the original edit's onSaved or resurrected edit mode.
    expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

describe('ProductForm price validation', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Code review fix: Number('') is 0, which passed the old Number.isNaN-only
  // check despite being an invalid price -- must be rejected client-side,
  // same as the existing all-whitespace-Name case, with no submit issued.
  it('shows a form-level error and does not submit when Price is blank', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/name/i), 'Valid Name');
    // Price left blank -- native `required` would normally block this, but
    // the type="number" input's value is simulated directly to exercise the
    // client-side guard the same way a bypass (or a future relaxation of
    // `required`) would.
    fireEvent.submit(screen.getByRole('button', { name: /add product/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Only the categories fetch happened -- no create POST was issued.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  // Code review fix: an absurdly large literal like 1e400 parses to
  // Infinity, which passed the old Number.isNaN-only check -- JSON.stringify
  // would have silently serialized it as `null` in the request body.
  it('shows a form-level error and does not submit when Price parses to Infinity', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/price/i), '1e400');
    // The native `max="1000000"` constraint would also block a click-driven
    // submit for a value this large -- dispatch `submit` directly (like the
    // blank-Price case above) to exercise this story's own JS-level guard in
    // isolation, independent of what the browser's constraint validation
    // happens to catch first.
    fireEvent.submit(screen.getByRole('button', { name: /add product/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Only the categories fetch happened -- no create POST was issued.
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });

  // Code review fix: a zero or negative price is neither NaN nor non-finite,
  // so it needs its own explicit `<= 0` check.
  it('shows a form-level error and does not submit when Price is zero or negative', async () => {
    const user = userEvent.setup();
    await renderReady();

    await user.type(screen.getByLabelText(/name/i), 'Valid Name');
    await user.type(screen.getByLabelText(/price/i), '-5');
    // The native `min="0.01"` constraint would also block a click-driven
    // submit for a negative value -- dispatch `submit` directly (like the
    // blank-Price case above) to exercise this story's own JS-level guard in
    // isolation, independent of what the browser's constraint validation
    // happens to catch first.
    fireEvent.submit(screen.getByRole('button', { name: /add product/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
  });
});
