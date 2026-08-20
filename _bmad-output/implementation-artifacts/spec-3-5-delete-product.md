---
title: 'Delete Product'
type: 'feature'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a681f148f27bf9994f5d1ee3070282221855a45a'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can create and edit products but have no way to remove one — `DELETE /api/products/{id}` exists and is reachable, but nothing in the UI calls it. This is also the last piece needed to exercise Epic 3's full create→list→edit→delete cycle end-to-end.

**Approach:** Add a "Delete" button per `ProductList` row, gated by a native `window.confirm()`; on confirmation, call `DELETE /api/products/{id}` via `apiFetch` and reuse `ProductList`'s own existing `fetchProducts()` to refresh on success.

## Boundaries & Constraints

**Always:**
- Delete requires `window.confirm()` before issuing the request — cancelling issues no API call.
- `DELETE /api/products/{id}` goes through `apiFetch` (credentials/CSRF already automatic).
- On success (204), the deleted item disappears — `ProductList` calls its own existing `fetchProducts()` to refresh, no page reload.
- On failure (404, network, 5xx), a visible error message is shown while the item **remains** in the list — the list itself is never replaced by an error state for a delete failure (only the mount-time fetch failure uses that existing full-list error branch).
- While a delete is in flight, that row's Delete button is disabled (loading); other rows' Edit/Delete stay interactive — concurrent deletes of different products are independent and safe.

**Ask First:** none — `window.confirm()` (native, zero dependency) satisfies "delete is confirmed" without custom modal UI, consistent with the "no modals" boundary from Stories 3.3/3.4.

**Never:**
- Do not build a custom confirmation dialog component — `window.confirm()` is sufficient and keeps this story's footprint to `ProductList.tsx` alone.
- Do not route delete success through `App.tsx`'s `refreshKey` mechanism — `ProductList` already owns its own fetch/state, unlike Create/Edit whose form lives outside it.
- Do not add optimistic removal that reverts on failure — the item is only removed after the server confirms (204), matching Story 3.4's "no optimistic updates" principle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete clicked, confirmed | User clicks Delete, confirms the dialog | `DELETE /api/products/{id}` fires; on 204, item disappears, no reload | N/A |
| Delete clicked, cancelled | User clicks Delete, cancels the dialog | No API call; item remains, list unchanged | N/A |
| Delete in flight | Confirmed, request pending | That row's Delete button disabled (loading) | N/A |
| Delete fails | `DELETE` → 404 or `ApiFailure` (network/5xx) | Visible error message; item remains in the list | N/A |

</frozen-after-approval>

## Code Map

- `ProductsController.cs` (`Delete`) -- `[Authorize]` `DELETE /api/products/{id:int}` → 204 / 404
- `client/src/components/ProductList.tsx` (`fetchProducts`) -- reuse directly, no changes, to refresh after a successful delete
- No Delete button/confirm/error-state logic exists yet in `ProductList.tsx` -- add fresh

## Tasks & Acceptance

**Execution:**
- [x] `client/src/components/ProductList.tsx` -- add a Delete button per row; `window.confirm()` gate; on confirm, `DELETE /api/products/{id}` via `apiFetch`; per-row `deletingId` loading state; on success, call existing `fetchProducts()`; on failure, show a visible delete-specific error while the list stays rendered
- [x] `client/src/components/ProductList.css` -- minimal styling for the Delete button and the delete-error message
- [x] `client/src/components/ProductList.test.tsx` -- tests covering every I/O matrix row
- [x] `client/src/App.test.tsx` -- extend the existing create/edit→refresh integration pattern with a full create→edit→delete cycle through the real `App`, confirming no page reload and auth state preserved throughout

**Acceptance Criteria:**
- Given the full create→list→edit→delete cycle, when exercised end-to-end, then auth state is preserved throughout with no page reload (PRD FR-5)

## Spec Change Log

## Design Notes

**Why `ProductList` refetches itself instead of using `refreshKey`:** Create/Edit's form lives outside `ProductList`, so they need `App.tsx`'s `key`-remount to signal a refresh. Delete's button lives inside `ProductList` itself — it can just call its own already-existing `fetchProducts()` directly, no cross-component signaling needed.

**Why a separate delete-error state, not the existing fetch-error branch:** `ProductList`'s current error state replaces the whole list, which would contradict this story's AC ("the item remains in the list"). A delete failure needs its own, more localized error surface.

## Verification

**Commands:**
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all tests pass, including every `ProductList` delete-mode row

**Manual checks (if no CLI):**
- Logged in, API+DB running: click Delete on a product, confirm — item disappears, no reload.
- Click Delete, cancel the dialog — item remains, no request sent.
- Stop the API, click Delete and confirm — visible error, item still in the list.

## Suggested Review Order

**The delete flow (review patches applied)**

- `handleDelete` — success path deliberately leaves the row "deleting" until the refetch removes it (review patch, fixes a flicker/re-click race confirmed by all three review layers); `deleteError` also now clears on any completed refetch (review patch).
  [`ProductList.tsx:163`](../../client/src/components/ProductList.tsx#L163)

- Re-entrancy guard, now with a regression test for the double-click-before-resolution window it was built to close (review patch).
  [`ProductList.test.tsx`](../../client/src/components/ProductList.test.tsx)

**Reused, unchanged**

- `describeError` — the same form-level-message pattern established across every other component in this app.
  [`ProductList.tsx:25`](../../client/src/components/ProductList.tsx#L25)

- The existing fetch-error branch, untouched — delete failures deliberately use a separate, more localized error surface instead.
  [`ProductList.tsx:230`](../../client/src/components/ProductList.tsx#L230)

**Test coverage**

- Every I/O matrix row plus the review's new re-entrancy regression test.
  [`ProductList.test.tsx`](../../client/src/components/ProductList.test.tsx)

- The full create→edit→delete cycle through the real `App`, satisfying AC3 (no page reload, auth preserved).
  [`App.test.tsx`](../../client/src/App.test.tsx)
