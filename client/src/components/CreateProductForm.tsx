import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../api/client';
import type { ApiFailure } from '../api/client';
import type { CategoryDto, ProductDto } from '../api/types';
import './CreateProductForm.css';

/**
 * The Category dropdown's three states: `GET /api/categories` in flight,
 * failed (form disabled per this story's Always boundary -- no retry, reload
 * the page), or loaded with the list used both to populate the dropdown and
 * to default `categoryId` to the first category.
 */
type CategoriesState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; categories: CategoryDto[] };

export interface CreateProductFormProps {
  /** Invoked after a successful (201) create -- App.tsx bumps its refreshKey to remount ProductList. */
  onCreated: () => void;
}

/**
 * Renders a failed `apiFetch` result as a single human-readable message --
 * mirrors `ProductList`'s/`AuthContext`'s `describeError` (network failure
 * vs. `problem.title`/`detail` vs. a last-resort status-code fallback). Kept
 * as its own copy rather than shared/exported, same rationale as
 * `AuthContext`'s copy: no coupling reason yet to introduce a shared helper
 * module for three call sites.
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
 * Controlled Name/Price/Category form calling `POST /api/products` via
 * `apiFetch`. Per this story's I/O matrix: categories are fetched on mount
 * and the form is disabled with a visible message if that fetch fails (no
 * retry -- reload the page); submit shows a loading state with inputs/button
 * disabled and is re-entrant-submit guarded (mirrors `LoginForm`); any
 * failure (400 validation, 400 CategoryNotFound, network/5xx) renders one
 * visible form-level error and leaves the form editable with entered values
 * preserved; success (201) resets the form and calls `onCreated` so
 * `App.tsx` can remount `ProductList` via a changing `key`.
 */
export function CreateProductForm({ onCreated }: CreateProductFormProps) {
  const [categoriesState, setCategoriesState] = useState<CategoriesState>({ status: 'loading' });

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a late setState after unmount, same pattern as
  // ProductList's/AuthContext's mountedRef.
  const mountedRef = useRef(true);

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
        if (result.data.length > 0) {
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
  }, []);

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
    // `NaN`) must be caught here rather than silently serialized.
    const trimmedName = name.trim();
    const parsedPrice = Number(price);
    const parsedCategoryId = Number(categoryId);

    if (!trimmedName || Number.isNaN(parsedPrice) || Number.isNaN(parsedCategoryId)) {
      setError('Please enter a valid name, price, and category.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    let result: Awaited<ReturnType<typeof apiFetch<ProductDto>>>;
    try {
      result = await apiFetch<ProductDto>('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          price: parsedPrice,
          categoryId: parsedCategoryId,
        }),
      });
    } catch {
      // apiFetch is documented to never throw/reject -- this is a safety
      // net in case that contract is ever violated, so the submit button
      // doesn't get stuck on "Adding…" forever with no visible error
      // (mirrors the same class of fix already applied to ProductList's/
      // AuthContext's fetch effects).
      if (!mountedRef.current) {
        return;
      }
      setError('Unexpected error -- please try again.');
      setIsSubmitting(false);
      return;
    }

    if (!mountedRef.current) {
      return;
    }

    if (!result.ok) {
      setError(describeError(result));
      setIsSubmitting(false);
      return;
    }

    // Success: reset to empty (Always boundary) and notify App.tsx so it can
    // bump its refreshKey and remount ProductList.
    setName('');
    setPrice('');
    setCategoryId(
      categoriesState.categories.length > 0 ? String(categoriesState.categories[0].id) : '',
    );
    setIsSubmitting(false);
    onCreated();
  };

  if (categoriesState.status === 'error') {
    return (
      <div className="create-product-form">
        <h2>Add Product</h2>
        <p className="create-product-form-error" role="alert">
          Could not load categories -- reload the page to try again.
        </p>
      </div>
    );
  }

  if (categoriesState.status === 'ready' && categoriesState.categories.length === 0) {
    // Loaded successfully but with zero categories: an empty <select> would
    // render as a required field with no options -- usable-looking but
    // never actually submittable, with no explanation. Treat it like the
    // fetch-failure case instead: disabled form, visible reason.
    return (
      <div className="create-product-form">
        <h2>Add Product</h2>
        <p className="create-product-form-error" role="alert">
          No categories exist yet -- create one first before adding a product.
        </p>
      </div>
    );
  }

  const categoriesLoading = categoriesState.status === 'loading';
  const disabled = isSubmitting || categoriesLoading;

  return (
    <div className="create-product-form">
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit}>
        <div className="create-product-form-field">
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
        <div className="create-product-form-field">
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
        <div className="create-product-form-field">
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
          <p className="create-product-form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={disabled}>
          {isSubmitting ? 'Adding…' : 'Add Product'}
        </button>
      </form>
    </div>
  );
}

export default CreateProductForm;
