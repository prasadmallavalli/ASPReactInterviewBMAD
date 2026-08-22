import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/client';
import type { ApiFailure } from '../api/client';
import type { ProductDto } from '../api/types';
import './ProductList.css';

/**
 * The three-and-a-bit render states from the I/O matrix: in-flight,
 * failed (network or 4xx/5xx), or fetched -- with "fetched, zero rows"
 * distinguished from "fetched, has rows" at render time rather than as a
 * separate state, since both come from the same successful `ApiResult`.
 */
type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; products: ProductDto[] };

/**
 * Renders a failed `apiFetch` result as a single human-readable message --
 * `problem.title`/`detail` when the server sent RFC 7807 ProblemDetails,
 * a dedicated message for network failures (retries already exhausted by
 * `apiFetch` itself), and a last-resort fallback for a failure response with
 * no parseable body.
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
 * Formats a product's price defensively -- `apiFetch` casts the response
 * body to `ProductDto[]` with no runtime validation, so a malformed server
 * response could hand us a non-numeric `price`. Falls back to a placeholder
 * rather than letting `.toFixed` throw and crash the whole list.
 */
function formatPrice(price: number): string {
  return typeof price === 'number' && Number.isFinite(price) ? `$${price.toFixed(2)}` : '—';
}

export interface ProductListProps {
  /** Story 3.4: invoked with the clicked row's product when its "Edit" button is clicked -- App.tsx lifts it into edit mode. Optional so ProductList still renders (no Edit column) if a caller omits it. */
  onEdit?: (product: ProductDto) => void;
  /**
   * Retro fix (Epic 3, Finding A): the id of the product currently open in
   * App.tsx's edit form, if any. `ProductForm`'s in-flight PUT is not itself
   * surfaced here -- disabling this row's Delete for the whole time it's
   * open in the edit form (not just while a save is in flight) is what
   * actually closes the race: clicking Delete on a row the edit form has
   * open would otherwise remove it server-side while the form keeps showing
   * it as live and submittable. Optional so ProductList still renders
   * standalone (e.g. in isolation in tests) if a caller omits it.
   */
  busyProductId?: number | null;
  /**
   * Retro fix (Epic 3, Finding B): App.tsx's refreshKey, previously passed
   * as this component's `key` prop to force a full remount on every
   * Create/Edit success. A remount reset `deletingIdsRef`/`deletingIds`,
   * silently dropping an unrelated row's own in-flight delete: the DELETE
   * request still completed server-side, but the *new* instance had no
   * memory of it, so that row reappeared fully interactive (Delete
   * re-enabled) until some unrelated future refresh. Passed as a plain prop
   * instead and watched by the mount effect below -- refetches without
   * remounting, so `deletingIdsRef`/`deletingIds` survive across it.
   */
  refreshSignal?: number;
}

/**
 * Fetches `/api/products` on mount via Story 3.1's `apiFetch` (no auth
 * required -- the endpoint is public per Story 2.3) and renders loading,
 * error (with Retry), empty-catalog, or populated-list states per this
 * story's I/O matrix. Mounted as the app's root view.
 */
export function ProductList({ onEdit, busyProductId, refreshSignal }: ProductListProps) {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  // True whenever a fetch (initial mount or a Retry click) is in flight --
  // drives the Retry button's disabled state and guards against re-entrant
  // Retry clicks firing overlapping requests.
  const [isFetching, setIsFetching] = useState(true);

  // Generation counter + mounted flag: a fetch's `.then`/`.catch` callback
  // only applies its result if (a) the component is still mounted and (b)
  // no newer fetch has superseded it since. Without this, an unmounted
  // component would still receive a late setState, and a slow first
  // response arriving after a faster Retry response could silently
  // overwrite newer state with stale data.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  // Story 3.5: which row(s) currently have a delete in flight -- a Set (not a
  // single id) so concurrent deletes of different products are independent,
  // per this story's Always boundary. `deletingIdsRef` mirrors the state
  // synchronously so a re-entrant click on the same row's Delete button
  // (before React has re-rendered the now-disabled button) is still rejected.
  const deletingIdsRef = useRef<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  // Story 3.5: a delete-specific error, separate from `state`'s fetch-error
  // branch -- that branch replaces the whole list, which would contradict
  // this story's AC that a failed delete leaves the item in the list.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchProducts = useCallback(() => {
    const requestId = (requestIdRef.current += 1);

    apiFetch<ProductDto[]>('/api/products')
      .then((result) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          // Unmounted, or a newer fetch has already superseded this one.
          return;
        }
        setIsFetching(false);
        // A completed (non-superseded) list load supersedes any prior
        // delete-specific error context -- otherwise a stale deleteError
        // banner (e.g. from a failed delete) would keep showing above a
        // table that's since been successfully reloaded via an unrelated
        // path (Retry, a future refresh trigger, etc). Deliberately placed
        // here rather than synchronously at the top of fetchProducts to
        // avoid a synchronous setState-in-effect call on mount (same
        // rationale as isFetching's initialization above).
        setDeleteError(null);

        if (!result.ok) {
          setState({ status: 'error', message: describeError(result) });
          return;
        }

        if (!Array.isArray(result.data)) {
          // Defensive guard: apiFetch never validates the response shape at
          // runtime, only casts it. A non-array body must not reach .map/.length.
          setState({ status: 'error', message: 'Unexpected response from server.' });
          return;
        }

        setState({ status: 'success', products: result.data });
      })
      .catch(() => {
        // apiFetch is documented to never throw/reject -- this is a safety
        // net in case that contract is ever violated, so the UI surfaces a
        // visible error + Retry instead of hanging on "Loading..." forever.
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          return;
        }
        setIsFetching(false);
        setState({ status: 'error', message: 'Unexpected error -- please try again.' });
      });
  }, []);

  // Mount-time fetch: isFetching is already initialized to `true`, so no
  // reset is needed here (avoids a synchronous setState-in-effect call
  // flagged by oxlint) -- only Retry needs to flip it back on explicitly.
  // Retro fix (Finding B): also depends on `refreshSignal` -- App.tsx bumps
  // it on every Create/Edit success, re-running this effect to refetch
  // without unmounting. `deletingIdsRef`/`deletingIds` live outside this
  // effect entirely, so they're untouched by a refreshSignal-triggered
  // refetch, unlike the full remount this replaced.
  useEffect(() => {
    mountedRef.current = true;
    fetchProducts();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchProducts, refreshSignal]);

  const handleRetry = useCallback(() => {
    if (isFetching) {
      // Re-entrant click while a fetch is already in flight -- ignore.
      return;
    }
    setIsFetching(true);
    fetchProducts();
  }, [fetchProducts, isFetching]);

  /**
   * Story 3.5: gated by `window.confirm()` -- cancelling issues no API call
   * (I/O matrix row 2). On confirm, `DELETE /api/products/{id}` via
   * `apiFetch`; on success (204) reuses `fetchProducts()` to refresh, never
   * `App.tsx`'s `refreshKey` (Never boundary -- ProductList already owns its
   * own fetch/state). On failure, sets `deleteError` instead of removing the
   * row -- no optimistic removal (Never boundary).
   */
  const handleDelete = useCallback(
    (product: ProductDto) => {
      if (deletingIdsRef.current.has(product.id)) {
        // Re-entrant click on the same row while its delete is already in
        // flight -- ignore (mirrors handleRetry's re-entrancy guard).
        return;
      }

      const confirmed = window.confirm(`Delete "${product.name}"?`);
      if (!confirmed) {
        return;
      }

      deletingIdsRef.current.add(product.id);
      setDeletingIds(new Set(deletingIdsRef.current));
      setDeleteError(null);

      apiFetch(`/api/products/${product.id}`, { method: 'DELETE' })
        .then((result) => {
          if (!result.ok) {
            // Failure: the row stays in the list (no optimistic removal), so
            // it genuinely needs to become interactive again.
            deletingIdsRef.current.delete(product.id);
            if (!mountedRef.current) {
              return;
            }
            setDeletingIds(new Set(deletingIdsRef.current));
            setDeleteError(describeError(result));
            return;
          }

          // Success: deliberately leave this id in deletingIdsRef/deletingIds
          // -- clearing it here would re-enable the just-deleted row's Delete
          // button for the brief window before fetchProducts()'s refetch
          // resolves and removes the row, letting a user re-click it and fire
          // a confusing second DELETE for an already-gone product. Whichever
          // way the refetch resolves, this is safe: on success the row (and
          // its now-vestigial disabled button) disappears entirely from the
          // re-rendered list; on failure `state` flips to the full-list error
          // view, which renders no rows/buttons at all.
          if (!mountedRef.current) {
            return;
          }
          fetchProducts();
        })
        .catch(() => {
          // apiFetch is documented to never throw/reject -- safety net only,
          // same rationale as fetchProducts's .catch above.
          deletingIdsRef.current.delete(product.id);
          if (!mountedRef.current) {
            return;
          }
          setDeletingIds(new Set(deletingIdsRef.current));
          setDeleteError('Unexpected error -- please try again.');
        });
    },
    [fetchProducts],
  );

  if (state.status === 'loading') {
    return (
      <div className="product-list" role="status">
        <p>Loading products…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="product-list product-list-error" role="alert">
        <p>{state.message}</p>
        <button type="button" onClick={handleRetry} disabled={isFetching}>
          Retry
        </button>
      </div>
    );
  }

  if (state.products.length === 0) {
    return (
      <div className="product-list product-list-empty">
        <p>No products found.</p>
      </div>
    );
  }

  return (
    <div className="product-list">
      <h1>Products</h1>
      {deleteError && (
        <p className="product-list-delete-error" role="alert">
          {deleteError}
        </p>
      )}
      <table className="product-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Price</th>
            <th scope="col">Category ID</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {state.products.map((product) => {
            const isDeleting = deletingIds.has(product.id);
            // Retro fix (Finding A): this row is currently open in the edit
            // form -- Edit is disabled while its own delete is in flight
            // (unchanged), and Delete is additionally disabled for as long as
            // this row is the one being edited, not just while a save is
            // in flight, closing the "delete the row I'm editing" race.
            const isBeingEdited = busyProductId === product.id;
            return (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{formatPrice(product.price)}</td>
                <td>{product.categoryId}</td>
                <td>
                  {onEdit && (
                    <button type="button" onClick={() => onEdit(product)} disabled={isDeleting}>
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => handleDelete(product)}
                    disabled={isDeleting || isBeingEdited}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ProductList;
