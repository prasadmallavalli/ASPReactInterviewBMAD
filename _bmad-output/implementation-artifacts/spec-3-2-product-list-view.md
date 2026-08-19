---
title: 'Product List View'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '9ebbf7a3fdf8449ff57334a4112cf3c738e65689'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No UI exists yet to view the product catalog — the API works, but a user has no way to see what's in it.

**Approach:** Build a `ProductList` component that calls `GET /api/products` via Story 3.1's `apiFetch` on mount, and renders one of three states: loading (in flight), error (network/4xx/5xx, with a Retry action), or the fetched product list — mounted as the app's root view.

## Boundaries & Constraints

**Always:**
- Data fetching goes through Story 3.1's `apiFetch('/api/products')` — no direct `fetch` calls, no new HTTP logic.
- `GET /api/products` requires no auth cookie or CSRF header (public per Story 2.3) — the component makes a plain unauthenticated call.
- Each product row shows `Name`, `Price`, and `CategoryId` (the raw id — no cross-referencing to a category name).
- An empty catalog (`200 []`) renders an explicit empty-state message, never a blank screen.
- On failure, a visible error message renders (using `problem.title`/`detail` when present) plus a "Retry" button that re-issues the same fetch.
- New component files live under `client/src/components/`, per the architecture's structural convention.

**Ask First:** none — plain CSS (no UI library) and `useState`/`useEffect` (no data-fetching library) match this project's established minimal-dependency preference.

**Never:**
- Do not resolve `CategoryId` to a category name (a second `/api/categories` call) — out of scope for a product-only list view; no Category CRUD UI exists in this epic either.
- Do not build Create/Edit/Delete UI — those are Stories 3.3–3.5.
- Do not add React Query/SWR or any other data-fetching library — a single list fetch with loading/error state doesn't need caching/sync machinery yet.
- Do not add React Router — this story doesn't introduce multi-page navigation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fetch in flight | Component just mounted | Loading indicator shown | N/A |
| Fetch succeeds, products exist | `GET /api/products` → 200, non-empty array | Loading replaced by a list of products (Name, Price, CategoryId) | N/A |
| Fetch succeeds, empty catalog | `GET /api/products` → 200, `[]` | Loading replaced by an explicit empty-state message | N/A |
| Fetch fails, network error | `apiFetch` returns `{ ok: false, networkError: true }` | Loading replaced by a visible error message + Retry button | Retry re-issues the fetch |
| Fetch fails, 4xx/5xx | `apiFetch` returns `{ ok: false, status, problem }` | Visible error message (using `problem` when present) + Retry button | Retry re-issues the fetch |

</frozen-after-approval>

## Code Map

- `client/src/App.tsx` -- currently stock Vite counter-demo boilerplate -- replace to render `ProductList` as the app's root view
- `client/src/api/client.ts` (`apiFetch`, `ApiResult`) -- reuse directly, no changes -- Story 3.1's foundation
- No `client/src/components/` directory exists yet -- create fresh
- No shared DTO types exist client-side yet -- add a `ProductDto` matching `src/Application/DTOs/ProductDto.cs` (`Id:int`, `Name:string`, `Price:decimal`, `CategoryId:int`)
- `src/Api/Controllers/ProductsController.cs` (`GetAll`) -- confirms `GET /api/products` → 200 `ProductDto[]`, no `[Authorize]`

## Tasks & Acceptance

**Execution:**
- [x] `client/src/api/types.ts` (new) -- `ProductDto` interface matching the API's DTO shape -- shared type for this and future stories
- [x] `client/src/components/ProductList.tsx` (new) -- fetches on mount via `apiFetch`, renders loading/empty/error/list states per the I/O matrix, error state includes a Retry button -- the feature itself
- [x] `client/src/components/ProductList.css` (new) -- minimal styling for the list and the three states -- presentable UI, no UI library
- [x] `client/src/App.tsx` -- replace stock boilerplate with `<ProductList />` -- mounts the feature as the app's root view
- [x] `client/package.json` -- add `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` as dev dependencies -- first story rendering actual component logic
- [x] `client/src/components/ProductList.test.tsx` (new) -- Vitest + Testing Library tests covering every I/O matrix row, including Retry re-issuing the fetch -- automated coverage

**Acceptance Criteria:**
- Given the product list renders successfully with products, when the DOM is inspected, then every product's `Name` and `Price` are visible
- Given the error state is showing, when the user clicks Retry, then a new `apiFetch` call is issued

## Spec Change Log

## Design Notes

**Why no data-fetching library:** a single list fetch with loading/error state needs no caching, pagination, or cross-component cache invalidation yet — `useState`/`useEffect` plus Story 3.1's `apiFetch` is sufficient. Revisit if Stories 3.3–3.5's mutations need to invalidate/refetch this list in a more complex way.

**Why no category-name resolution:** keeps this story single-endpoint. Cross-referencing `/api/categories` would mean designing a lookup/caching strategy nowhere specified, for a display need this story's AC doesn't ask for.

**Testing Library added now:** the first story rendering real component logic — matches the "missing test-tooling" gap already logged against Story 3.1's review.

## Verification

**Commands:**
- `cd client && npm install` -- expected: installs the new Testing Library dev dependencies without error
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all tests pass, including every `ProductList` I/O matrix row

**Manual checks (if no CLI):**
- With the API and DB running, start the client (`npm run dev`) and visit `http://localhost:5173` — confirm the product list (or empty-state message) renders correctly.
- Stop the API, reload the client — confirm the error state and Retry button appear; restart the API and click Retry — confirm the list then loads.

## Suggested Review Order

**The four render states**

- Entry point: state machine and the mount-time fetch.
  [`ProductList.tsx:56`](../../client/src/components/ProductList.tsx#L56)

- `fetchProducts` — generation-counter/mounted guards (review patch) prevent stale responses and post-unmount `setState`.
  [`ProductList.tsx:72`](../../client/src/components/ProductList.tsx#L72)

- Retry — disabled while a fetch is in flight, preventing overlapping requests (review patch).
  [`ProductList.tsx:120`](../../client/src/components/ProductList.tsx#L120)

- Error state, using `describeError`'s message + Retry button.
  [`ProductList.tsx:137`](../../client/src/components/ProductList.tsx#L137)

- Empty-catalog state, distinguished from the populated list at render time.
  [`ProductList.tsx:148`](../../client/src/components/ProductList.tsx#L148)

**Response handling**

- `describeError` — ProblemDetails-aware message formatting, now with test coverage for its no-body and title-only branches (review patch).
  [`ProductList.tsx:25`](../../client/src/components/ProductList.tsx#L25)

- `formatPrice` — defensive guard against a non-numeric price (review patch), added alongside the `Array.isArray` guard on the success path.
  [`ProductList.tsx:46`](../../client/src/components/ProductList.tsx#L46)

**Test coverage**

- Every I/O matrix row, the Retry acceptance criterion, and the two new `describeError` edge cases.
  [`ProductList.test.tsx`](../../client/src/components/ProductList.test.tsx)

**Peripherals**

- `ProductDto` — client-side mirror of the API's DTO shape.
  [`types.ts`](../../client/src/api/types.ts)

- App root now mounts `ProductList` in place of the Vite boilerplate.
  [`App.tsx`](../../client/src/App.tsx)
