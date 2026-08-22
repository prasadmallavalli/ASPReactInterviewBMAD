import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type { ApiFailure } from '../api/client';
import type { CategoryDto, ProductDto } from '../api/types';
import './ProductForm.css';

/**
 * The Category dropdown's three states: `GET /api/categories` in flight,
 * failed (form disabled per this story's Always boundary -- no retry, reload
 * the page), or loaded with the list used both to populate the dropdown and
 * to default `categoryId` to the first category (create mode only -- edit
 * mode defaults it to the edited product's own categoryId instead).
 */
type CategoriesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; categories: CategoryDto[] };

/**
 * Discriminated on `mode` so the invalid "edit without initialProduct/onCancel"
 * combination is a compile error, not something papered over at runtime with
 * a non-null assertion (code review fix -- the previous shape allowed
 * `mode: 'edit'` with both omitted, relying on `initialProduct!.id` in
 * `handleSubmit`).
 */
export type ProductFormProps =
  | {
      /** Posts to `/api/products`. */
      mode: 'create';
      /** Invoked after a successful (201) create -- App.tsx bumps its refreshKey to remount ProductList. */
      onSaved: () => void;
    }
  | {
      /** PUTs to `/api/products/{id}`. */
      mode: 'edit';
      /** Supplies the id to PUT and the values to pre-fill. */
      initialProduct: ProductDto;
      /** Invoked after a successful (200) edit -- App.tsx bumps its refreshKey to remount ProductList. */
      onSaved: () => void;
      /** Invoked when Cancel is clicked, with no API call. */
      onCancel: () => void;
    };

/**
 * Renders a failed `apiFetch` result as a single human-readable message --
 * mirrors `ProductList`'s/`AuthContext`'s `describeError` (network failure
 * vs. `problem.title`/`detail` vs. a last-resort status-code fallback). Kept
 * as its own copy rather than shared/exported, same rationale as
 * `AuthContext`'s copy: no coupling reason yet to introduce a shared helper
 * module for the growing number of call sites.
 */
function describeError(result: ApiFailure): string {
  if (result.networkError) {
    return 'Network error -- could not reach the server. Check your connection and try again.';
  }

  const parts = [result.problem?.title, result.problem?.detail].filter(
    (part): part is string => Boolean(part),
  );
  if (parts.length > 0) {
    return parts.join(': ');
  }

  return result.status ? `Request failed (status ${result.status}).` : 'Request failed.';
}

/**
 * Controlled Name/Price/Category form, mode-aware per Story 3.4: `create`
 * calls `POST /api/products` (original Story 3.3 behavior, unchanged), `edit`
 * pre-fills from `initialProduct` and calls `PUT /api/products/{id}` instead.
 * Everything else -- category fetch on mount, native validation, one
 * form-level error, loading/re-entrant-submit guard -- is shared unchanged
 * between the two modes per this story's Always boundary.
 *
 * Per the I/O matrix: categories are fetched on mount and the form is
 * disabled with a visible message if that fetch fails (no retry -- reload
 * the page); submit shows a loading state with inputs/button disabled and is
 * re-entrant-submit guarded (mirrors `LoginForm`); any failure (400
 * validation, 400 CategoryNotFound, 404, network/5xx) renders one visible
 * form-level error and leaves the form editable with entered values
 * preserved -- edit mode stays in edit mode on failure; success resets to
 * create-mode defaults (create) or calls `onSaved` for `App.tsx` to return to
 * create mode (edit), either way bumping `ProductList`'s `refreshKey`.
 */
export function ProductForm(props: ProductFormProps) {
  const { mode, onSaved } = props;
  // Narrowed via `props.mode` (not the already-destructured `mode` local)
  // so TypeScript actually ties `initialProduct`/`onCancel`'s presence to the
  // discriminant -- see ProductFormProps.
  const initialProduct = props.mode === 'edit' ? props.initialProduct : undefined;
  const onCancel = props.mode === 'edit' ? props.onCancel : undefined;

  const [categoriesState, setCategoriesState] = useState<CategoriesState>({ status: 'loading' });

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [price, setPrice] = useState(initialProduct ? String(initialProduct.price) : '');
  const [categoryId, setCategoryId] = useState(
    initialProduct ? String(initialProduct.categoryId) : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a late setState after unmount, same pattern as
  // ProductList's/AuthContext's mountedRef.
  const mountedRef = useRef(true);

  // Code review fix: the categories-fetch effect below has an empty
  // dependency array (must only ever run once per instance -- see its own
  // comment), so its `.then` callback closes over whatever `mode` was on the
  // very first render. Since App.tsx now keeps a single persistent
  // ProductForm instance and just changes `mode`/`initialProduct` props (no
  // remount), that stale closure would otherwise still see `mode ===
  // 'create'` if the user clicks Edit before the categories fetch resolves --
  // silently overwriting the just-pre-filled edit categoryId with the first
  // category once the fetch finally completes. Reading `modeRef.current`
  // instead of the closed-over `mode` fixes that: it's reassigned on every
  // render, so the callback always sees the mode current *at the time it
  // resolves*, not the mode at mount.
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    mountedRef.current = true;

    apiFetch<CategoryDto[]>('/api/categories')
      .then((result) => {
        if (!mountedRef.current) {
          return;
        }

        if (!result.ok || !Array.isArray(result.data)) {
          setCategoriesState({ status: 'error' });
          return;
        }

        setCategoriesState({ status: 'ready', categories: result.data });
        // Create mode only: default categoryId to the first category. Edit
        // mode already initialized categoryId from initialProduct above, and
        // must not clobber it once categories resolve. Reads modeRef.current
        // (not the closed-over `mode`) -- see the comment on modeRef above.
        if (modeRef.current === 'create' && result.data.length > 0) {
          setCategoryId(String(result.data[0].id));
        }
      })
      .catch(() => {
        // apiFetch is documented to never throw/reject -- this is a safety
        // net in case that contract is ever violated, so the dropdown
        // doesn't hang on "loading" forever.
        if (!mountedRef.current) {
          return;
        }
        setCategoriesState({ status: 'error' });
      });

    return () => {
      mountedRef.current = false;
    };
    // Deliberately mount-only: the categories fetch itself must only ever
    // run once per ProductForm instance -- see the targetKey resync effect
    // below for what happens when App.tsx switches which product (if any)
    // this same instance is editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App.tsx renders a single persistent <ProductForm> instance and just
  // changes its `mode`/`initialProduct` props (no `key`, so React reuses the
  // same instance rather than unmounting/remounting) -- switching from
  // create to editing product A, from editing A to editing B, or back to
  // create via Cancel/a successful save. `useState`'s initializer above only
  // applies on the very first mount, so this effect re-syncs Name/Price/
  // Category (and clears any leftover error/submitting state from a
  // previous target) whenever *what's being edited* changes thereafter.
  // Deliberately does NOT touch categoriesState/refetch categories -- per
  // this story's I/O matrix, Cancel must not issue any API call.
  const targetKey = mode === 'edit' && initialProduct ? `edit-${initialProduct.id}` : 'create';

  // Code review fix: mirrors modeRef above, for the same class of staleness
  // bug but in handleSubmit -- see its use there.
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;

  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      // Initial mount: useState initializers above already set the correct
      // values for this render's target -- nothing to resync yet.
      isFirstRenderRef.current = false;
      return;
    }

    if (mode === 'edit' && initialProduct) {
      setName(initialProduct.name);
      setPrice(String(initialProduct.price));
      setCategoryId(String(initialProduct.categoryId));
    } else {
      setName('');
      setPrice('');
      setCategoryId(
        categoriesState.status === 'ready' && categoriesState.categories.length > 0
          ? String(categoriesState.categories[0].id)
          : '',
      );
    }
    setError(null);
    setIsSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed only on targetKey (mode+initialProduct.id collapsed to one value); categoriesState is read from this render's closure, not a trigger.
  }, [targetKey]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || categoriesState.status !== 'ready') {
      // Re-entrant submit while a request is already in flight, or the
      // categories fetch hasn't resolved yet -- ignore (the submit button is
      // also disabled in both cases, this is a defensive backstop).
      return;
    }

    // Native HTML5 `required` only blocks a literally empty Name -- an
    // all-whitespace value still passes it and would otherwise reach the
    // server as an empty string after `.trim()`. Price/CategoryId are
    // number-typed state but originate from string inputs, so an
    // empty/invalid value (`Number('')` is `0`, `Number('not-a-number')` is
    // `NaN`) must be caught here rather than silently serialized. Price is
    // additionally checked for finiteness, positivity, and an upper bound
    // (code review fix / retro fix, Finding H): `Number('')` is `0` (passes
    // `!Number.isNaN`, fails `<= 0` here), an absurdly large literal like
    // `1e400` parses to `Infinity` (passes `!Number.isNaN`, fails
    // `!Number.isFinite` here), and a value above 1,000,000 would otherwise
    // bypass the native `max="1000000"` attribute the same way `fireEvent.submit`
    // already proves the other native constraints can be bypassed -- all
    // three would otherwise reach the network call, with `Infinity` silently
    // serializing to `null` via `JSON.stringify`.
    const trimmedName = name.trim();
    const parsedPrice = Number(price);
    const parsedCategoryId = Number(categoryId);

    if (
      !trimmedName ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0 ||
      parsedPrice > 1_000_000 ||
      Number.isNaN(parsedCategoryId)
    ) {
      setError('Please enter a valid name, price, and category.');
      return;
    }

    // Code review fix: captures *this* submission's target identity before
    // the request goes out. When it resolves, `targetKeyRef.current` is
    // compared against this snapshot (see below) -- if the user has since
    // switched to editing a different product, cancelled, or returned to
    // create mode, this response is stale and must not be applied. Mirrors
    // `ProductList`'s own `requestIdRef` stale-response guard.
    const submittedTargetKey = targetKey;

    setIsSubmitting(true);
    setError(null);

    const body = JSON.stringify({
      name: trimmedName,
      price: parsedPrice,
      categoryId: parsedCategoryId,
    });

    let result: Awaited<ReturnType<typeof apiFetch<ProductDto>>>;
    try {
      result = initialProduct
        ? await apiFetch<ProductDto>(`/api/products/${initialProduct.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
        : await apiFetch<ProductDto>('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
    } catch {
      // apiFetch is documented to never throw/reject -- this is a safety
      // net in case that contract is ever violated, so the submit button
      // doesn't get stuck on "Adding…"/"Saving…" forever with no visible
      // error (mirrors the same class of fix already applied to
      // ProductList's/AuthContext's fetch effects).
      if (!mountedRef.current || targetKeyRef.current !== submittedTargetKey) {
        return;
      }
      setError('Unexpected error -- please try again.');
      setIsSubmitting(false);
      return;
    }

    if (!mountedRef.current || targetKeyRef.current !== submittedTargetKey) {
      // Unmounted, or (code review fix) the user has switched to a different
      // edit target / cancelled / returned to create mode since this request
      // was sent -- applying this response now would silently stomp on
      // whatever the user is doing next (e.g. bouncing them out of editing a
      // different product back to create mode). The target that switched
      // away already reset its own isSubmitting/error state via the
      // targetKey resync effect, so there's nothing left to clean up here.
      return;
    }

    if (!result.ok) {
      setError(describeError(result));
      setIsSubmitting(false);
      return;
    }

    if (mode === 'edit') {
      // Success: notify App.tsx so it can bump refreshKey (remount
      // ProductList) and clear editingProduct back to null. Local field
      // state is not reset here -- App.tsx's resulting mode="create"
      // re-render flips targetKey, and the resync effect above resets the
      // fields to blank once that happens.
      setIsSubmitting(false);
      onSaved();
      return;
    }

    // Create-mode success: reset to empty (Always boundary) and notify
    // App.tsx so it can bump its refreshKey and remount ProductList.
    setName('');
    setPrice('');
    setCategoryId(
      categoriesState.categories.length > 0 ? String(categoriesState.categories[0].id) : '',
    );
    setIsSubmitting(false);
    onSaved();
  };

  const formClassName = 'product-form';
  const errorClassName = 'product-form-error';
  const heading = mode === 'edit' ? 'Edit Product' : 'Add Product';

  if (categoriesState.status === 'error') {
    return (
      <div className={formClassName}>
        <h2>{heading}</h2>
        <p className={errorClassName} role="alert">
          Could not load categories -- reload the page to try again.
        </p>
        {mode === 'edit' && (
          <div className="product-form-actions">
            <button type="button" className="product-form-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (categoriesState.status === 'ready' && categoriesState.categories.length === 0) {
    // Loaded successfully but with zero categories: an empty <select> would
    // render as a required field with no options -- usable-looking but
    // never actually submittable, with no explanation. Treat it like the
    // fetch-failure case instead: disabled form, visible reason.
    return (
      <div className={formClassName}>
        <h2>{heading}</h2>
        <p className={errorClassName} role="alert">
          No categories exist yet -- create one first before adding a product.
        </p>
        {mode === 'edit' && (
          <div className="product-form-actions">
            <button type="button" className="product-form-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  const categoriesLoading = categoriesState.status === 'loading';
  const disabled = isSubmitting || categoriesLoading;

  return (
    <div className={formClassName}>
      <h2>{heading}</h2>
      <form onSubmit={handleSubmit}>
        <div className="product-form-field">
          <label htmlFor="product-name">Name</label>
          <input
            id="product-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={200}
            disabled={disabled}
          />
        </div>
        <div className="product-form-field">
          <label htmlFor="product-price">Price</label>
          <input
            id="product-price"
            name="price"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
            min="0.01"
            max="1000000"
            step="0.01"
            disabled={disabled}
          />
        </div>
        <div className="product-form-field">
          <label htmlFor="product-category">Category</label>
          <select
            id="product-category"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
            disabled={disabled}
          >
            {categoriesLoading && <option value="">Loading categories…</option>}
            {categoriesState.status === 'ready' &&
              categoriesState.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
        </div>
        {error && (
          <p className={errorClassName} role="alert">
            {error}
          </p>
        )}
        <div className="product-form-actions">
          <button type="submit" disabled={disabled}>
            {isSubmitting ? (mode === 'edit' ? 'Saving…' : 'Adding…') : mode === 'edit' ? 'Save' : 'Add Product'}
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              className="product-form-cancel"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default ProductForm;
