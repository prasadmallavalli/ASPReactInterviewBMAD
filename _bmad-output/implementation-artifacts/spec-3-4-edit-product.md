---
title: 'Edit Product'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'db3033e9c72e152d103189d556a0a851e5074cc6'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can create products (Story 3.3) but can't fix a mistake or update a price/category afterward — `PUT /api/products/{id}` exists and is reachable, but nothing in the UI calls it.

**Approach:** Generalize `CreateProductForm` into a mode-aware `ProductForm` (`create` | `edit`) reusing its existing validation/error/loading logic, add an "Edit" button per row in `ProductList` that lifts the selected product to `App.tsx`, and switch `ProductForm` into edit mode (pre-filled, submitting `PUT` instead of `POST`) when a product is selected.

## Boundaries & Constraints

**Always:**
- Edit mode pre-fills Name/Price/Category from the selected product and submits via `PUT /api/products/{id}` instead of `POST /api/products`; everything else (categories fetch, native validation, one form-level error, loading/re-entrant-submit guard) is reused unchanged from the existing create-mode logic.
- `ProductList` gains an `onEdit?: (product: ProductDto) => void` prop and one "Edit" button per row — no other row changes.
- `App.tsx` tracks which product (if any) is being edited; a successful save or Cancel returns to create mode.
- A successful edit reuses Story 3.3's exact `refreshKey`-bump mechanism to remount/refetch `ProductList` — no new refresh mechanism.

**Ask First:** none — generalizing `CreateProductForm` into `ProductForm(mode)` avoids duplicating ~150 lines of near-identical form/validation/error logic; same "extract once duplication crosses a component-sized threshold" judgment already applied throughout this epic.

**Never:**
- Do not build Delete UI — Story 3.5.
- Do not add inline (in-table) editing — the single shared form stays the only edit surface, consistent with "no modals/routing."
- Do not add field-level error highlighting — same reasoning as Story 3.3 (unverified `ValidationProblemDetails.errors` shape).
- Do not add optimistic UI updates — the list only reflects a change after the server confirms it (remount-on-success).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit clicked on a row | User clicks "Edit" | `ProductForm` switches to edit mode, pre-filled with that product's values | N/A |
| Cancel clicked in edit mode | User clicks "Cancel" | Returns to create mode; no API call | N/A |
| Edit in flight | Submit clicked, request pending | Loading state; inputs/button disabled | N/A |
| Valid edit submitted | `PUT /api/products/{id}` → 200 | `ProductList` remounts showing the update; form returns to create mode | N/A |
| Invalid edit or failure | `PUT` → 400 (validation/`CategoryNotFound`), 404, or `ApiFailure` | Visible form-level error; stays in edit mode, values preserved | N/A |

</frozen-after-approval>

## Code Map

- `ProductsController.cs` (`Update`) -- `[Authorize]` `PUT /api/products/{id:int}` → 200 `ProductDto` / 404 (bare `NotFound()`) / 400 `CategoryNotFound` `Problem()` / 400 auto `ValidationProblemDetails` -- same `ProductRequestDto` as `Create`
- `client/src/components/CreateProductForm.tsx` -- generalize into `ProductForm.tsx` with a `mode` prop; reuse category-fetch/validation/error logic as-is
- `client/src/components/ProductList.tsx` -- add an `onEdit` prop + "Edit" button per row
- `client/src/App.tsx` -- track `editingProduct` state; render `ProductForm` in the right mode; wire `onEdit`/`onCancel`/`onSuccess`

## Tasks & Acceptance

**Execution:**
- [x] `client/src/components/CreateProductForm.tsx` → `client/src/components/ProductForm.tsx` -- add `mode: 'create' | 'edit'`, `initialProduct?`, `onCancel?` props; submit routes to `POST` or `PUT /{id}` accordingly
- [x] `client/src/components/CreateProductForm.css` → `client/src/components/ProductForm.css` -- match rename; add minimal Cancel-button styling
- [x] `client/src/components/ProductList.tsx` -- add `onEdit` prop + "Edit" button per row
- [x] `client/src/App.tsx` -- track `editingProduct`; render `ProductForm` in the right mode; wire `onEdit`/`onCancel`/`onSuccess`
- [x] `client/src/components/CreateProductForm.test.tsx` → `client/src/components/ProductForm.test.tsx` -- keep existing create-mode coverage passing; add edit-mode coverage per the matrix
- [x] `client/src/components/ProductList.test.tsx` -- add coverage for the Edit button invoking `onEdit` with the right product
- [x] `client/src/App.test.tsx` -- extend the existing create→refresh integration test pattern to cover edit→refresh too

**Acceptance Criteria:**
- Given an existing product is edited and saved, when `ProductList` re-renders, then its updated `Name`/`Price` are visible without a page reload

## Spec Change Log

- Implementation note: `ProductForm`'s success callback is named `onSaved` (not `onSuccess` as worded in the Tasks list) since it now covers both create and edit success, mirroring the existing `onCreated`→`onSaved` rename; behavior is unchanged from what the task described.
- Implementation note: `ProductForm` is rendered as a single persistent instance in `App.tsx` (no `key` prop forcing a remount on mode/target switch) -- a `useEffect` inside `ProductForm` re-syncs Name/Price/Category/error/isSubmitting whenever the edited target changes (switching products, or returning to create mode via Cancel or a successful save). This was chosen over a remount-via-`key` approach specifically so Cancel truly issues zero API calls (a remount would have re-fetched `/api/categories`), matching the I/O matrix's "no API call" requirement for Cancel exactly.

## Design Notes

**Why generalize instead of duplicating:** `CreateProductForm` and an edit form would share nearly all of their logic (category fetch, native validation, one form-level error, loading/re-entrant guard) — only the initial values, HTTP verb/URL, and presence of Cancel differ. A `mode` prop avoids ~150 lines of copy-paste drift risk.

**Why 404 isn't a separate matrix row:** `AddProblemDetails()` (Story 1.x) already reshapes every non-success status, including a bare `NotFound()`, into a ProblemDetails-compatible body — the existing `describeError` fallback chain (title/detail → status-code message) already handles it with no special-casing needed.

## Verification

**Commands:**
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all tests pass, including every `ProductForm`/`ProductList` edit-mode row

**Manual checks (if no CLI):**
- Logged in, API+DB running: click Edit on a product, change its price, save — confirm the list shows the new price with no reload.
- Click Edit, then Cancel — confirm the form returns to create mode with no API call.
- Edit a product, submit with an empty Name — confirm a visible error, still in edit mode.

## Suggested Review Order

**The cross-row-edit race (review patch, the most important stop)**

- `handleSubmit` — captures `submittedTargetKey` before the request, checked against `targetKeyRef.current` on both the catch and success/failure paths to drop stale responses.
  [`ProductForm.tsx:210`](../../client/src/components/ProductForm.tsx#L210)

- Regression test reproducing the exact scenario: Edit A → Save pending → switch to Edit B → A's stale PUT resolves → B's edit is undisturbed.
  [`ProductForm.test.tsx:503`](../../client/src/components/ProductForm.test.tsx#L503)

**Type safety and validation (review patches)**

- `ProductFormProps` — now a discriminated union; the invalid "edit without initialProduct/onCancel" combination is a compile error, not a runtime non-null-assertion risk.
  [`ProductForm.tsx:86`](../../client/src/components/ProductForm.tsx#L86)

- `modeRef` — fixes a stale-closure bug where clicking Edit before the initial categories fetch resolved could silently overwrite the pre-filled category.
  [`ProductForm.tsx:120`](../../client/src/components/ProductForm.tsx#L120)

- Price validation — now rejects non-finite/non-positive values (blank input, `1e400` overflow), not just `NaN`.
  [`ProductForm.tsx:210`](../../client/src/components/ProductForm.tsx#L210)

**The mode-aware core**

- `describeError` — the same form-level-message pattern established across `ProductList`/`AuthContext`/`CreateProductForm`.
  [`ProductForm.tsx:53`](../../client/src/components/ProductForm.tsx#L53)

- Categories-load-failed and empty-categories states.
  [`ProductForm.tsx:332`](../../client/src/components/ProductForm.tsx#L332)

**The edit entry point and wiring**

- `ProductList`'s Edit button per row.
  [`ProductList.tsx`](../../client/src/components/ProductList.tsx)

- `App.tsx`'s `editingProduct` state, gating between create/edit mode.
  [`App.tsx`](../../client/src/App.tsx)

**Test coverage**

- Every I/O matrix row across create and edit modes, plus the review's new validation and staleness-guard cases.
  [`ProductForm.test.tsx`](../../client/src/components/ProductForm.test.tsx)

- The real create/edit→refresh and Cancel integration through `App`.
  [`App.test.tsx`](../../client/src/App.test.tsx)
