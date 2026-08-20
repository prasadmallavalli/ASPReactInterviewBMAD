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
}

/**
 * Fetches `/api/products` on mount via Story 3.1's `apiFetch` (no auth
 * required -- the endpoint is public per Story 2.3) and renders loading,
 * error (with Retry), empty-catalog, or populated-list states per this
 * story's I/O matrix. Mounted as the app's root view.
 */
export function ProductList({ onEdit }: ProductListProps) {
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

  const fetchProducts = useCallback(() => {
    const requestId = (requestIdRef.current += 1);

    apiFetch<ProductDto[]>('/api/products')
      .then((result) => {
        if (!mountedRef.current || requestId !== requestIdRef.current) {
          // Unmounted, or a newer fetch has already superseded this one.
          return;
        }
        setIsFetching(false);

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
  useEffect(() => {
    mountedRef.current = true;
    fetchProducts();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchProducts]);

  const handleRetry = useCallback(() => {
    if (isFetching) {
      // Re-entrant click while a fetch is already in flight -- ignore.
      return;
    }
    setIsFetching(true);
    fetchProducts();
  }, [fetchProducts, isFetching]);

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
      <table className="product-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Price</th>
            <th scope="col">Category ID</th>
            {onEdit && <th scope="col">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {state.products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{formatPrice(product.price)}</td>
              <td>{product.categoryId}</td>
              {onEdit && (
                <td>
                  <button type="button" onClick={() => onEdit(product)}>
                    Edit
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ProductList;
