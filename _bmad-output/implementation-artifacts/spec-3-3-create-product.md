---
title: 'Create Product'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'f484041b01ce3585c5bb4390113ac033ade9e0d1'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users can view the catalog (Story 3.2) but have no way to add a product — `POST /api/products` exists and is now reachable (login form, prerequisite), but nothing in the UI calls it.

**Approach:** Build a `CreateProductForm` (Name, Price, Category dropdown) that submits via `apiFetch`, and wire it into `App.tsx` alongside `ProductList` so a successful create remounts the list (via a changing `key`) to reflect the new product without a page reload.

## Boundaries & Constraints

**Always:**
- POST goes through `apiFetch` — CSRF header and credentials are already automatic, no extra wiring needed.
- The Category dropdown is populated from `GET /api/categories` on mount; if that fetch fails, the form is disabled with a visible message (no retry — reload the page).
- Name/Price inputs use native HTML5 validation (`required`, `type="number"`, `min="0.01"`, `max="1000000"`, `step="0.01"`) mirroring the backend's Data Annotation constraints — same pattern just established for `LoginForm` (no `noValidate`).
- Any 400 (validation or `CategoryNotFound`) or other failure (network/5xx) renders one visible form-level error message; the form stays editable with entered values preserved.
- On success (201), the form resets to empty and `ProductList` is remounted (changing `key` prop from `App.tsx`) so the new product appears with no page reload and no changes to `ProductList`'s own internals.
- Submit shows a loading state (inputs/button disabled), re-entrant-submit guarded — mirrors `LoginForm`'s established pattern.

**Ask First:** none — remounting `ProductList` via `key` (not a new state-management library) matches this project's minimal-footprint preference.

**Never:**
- Do not build Edit/Delete UI — Stories 3.4/3.5.
- Do not add field-level error highlighting tied to `ValidationProblemDetails.errors`'s exact shape — unverified by any existing test; one form-level message satisfies the AC's "field-level or form-level" without betting on an unconfirmed wire contract.
- Do not add a shared Context/state-management library for cross-component refresh — the `key`-remount trick is sufficient for this one need.
- Do not add routing/tabs/modals — the form renders inline, always visible alongside the list.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Categories fail to load on mount | `GET /api/categories` fails | Form shows a message, submit disabled | N/A |
| Submission in flight | Submit clicked, request pending | Loading state; inputs/button disabled | N/A |
| Valid submission | `POST /api/products` → 201 | Form resets; `ProductList` remounts and shows the new product, no page reload | N/A |
| Invalid submission, Name/Price | `POST` → 400 `ValidationProblemDetails` | Visible form-level error; form stays editable | N/A |
| Invalid submission, bad CategoryId | `POST` → 400 `Problem` (`CategoryNotFound`) | Visible form-level error; form stays editable | N/A |
| Network/5xx failure | `apiFetch` returns `ApiFailure` | Visible form-level error; form stays editable | N/A |

</frozen-after-approval>

## Code Map

- `ProductsController.cs` (`Create`) -- `[Authorize]` `POST /api/products` → 201 `ProductDto` (+`Location`) / 400 `CategoryNotFound` `Problem()` / 400 auto `ValidationProblemDetails`
- `ProductRequestDto.cs` -- `Name` required+`StringLength(200)`; `Price` `Range(0.01, 1000000)`; `CategoryId` no attribute (service-checked)
- `CategoriesController.cs` (`GetAll`) -- public `GET /api/categories` → 200 `CategoryDto[]` (`id`, `name`)
- `client/src/api/client.ts` (`apiFetch`) -- reuse directly; CSRF/credentials already automatic on mutating methods
- `client/src/auth/LoginForm.tsx` -- pattern to mirror: controlled inputs, `isSubmitting`/`error` state, re-entrant-submit guard, `role="alert"` error
- `client/src/App.tsx` -- currently renders `<ProductList />` unconditionally when authenticated; owns the new refresh-key state

## Tasks & Acceptance

**Execution:**
- [x] `client/src/api/types.ts` -- add `CategoryDto` (`id`, `name`) -- shared type for the dropdown
- [x] `client/src/components/CreateProductForm.tsx` (new) -- fetches categories on mount; Name/Price/Category inputs; submit → `apiFetch('/api/products', ...)`; loading/error/reset per the matrix -- the feature itself
- [x] `client/src/components/CreateProductForm.css` (new) -- minimal styling, no UI library
- [x] `client/src/App.tsx` -- render `CreateProductForm` alongside `ProductList` when authenticated; own a `refreshKey` state bumped on successful create, passed as `<ProductList key={refreshKey} />`
- [x] `client/src/components/CreateProductForm.test.tsx` (new) -- tests covering every I/O matrix row

**Acceptance Criteria:**
- Given a product is created successfully, when `ProductList` re-renders, then the new product's `Name` is visible without a page reload

## Spec Change Log

## Design Notes

**Why one form-level error, not per-field:** the exact shape of `ValidationProblemDetails.errors` for this endpoint isn't confirmed by any existing test (investigated, none found) — betting client code on an unverified wire contract risks a silent mismatch. A single message satisfies the AC without that risk; per-field highlighting can be added later once the shape is empirically confirmed.

**Why `key`-remount instead of a shared context:** `ProductList` has zero refresh hook today. Passing a changing `key` from `App.tsx` forces a clean remount (re-running its existing, already-reviewed fetch effect) with zero changes to its internals — proportionate to a single refresh need, versus introducing a new shared-state layer.

## Verification

**Commands:**
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all tests pass, including every `CreateProductForm` I/O matrix row

**Manual checks (if no CLI):**
- Logged in, API+DB running: submit a valid product — confirm it appears in the list below with no reload.
- Submit with Price `0` or empty Name — confirm a visible error, form stays editable.
- Submit with the DB's SQL Server stopped — confirm a visible error, form stays editable.

## Suggested Review Order

**The form (`CreateProductForm`)**

- Entry point: submit validation and the POST call — now try/catch-guarded and pre-validated (review patches).
  [`CreateProductForm.tsx:105`](../../client/src/components/CreateProductForm.tsx#L105)

- Empty-categories case — treated like a fetch failure instead of an unusable empty `<select>` (review patch).
  [`CreateProductForm.tsx:189`](../../client/src/components/CreateProductForm.tsx#L189)

- Categories-fetch-failed case, for comparison.
  [`CreateProductForm.tsx:178`](../../client/src/components/CreateProductForm.tsx#L178)

- `describeError` — the same form-level-message pattern established in `ProductList`/`AuthContext`.
  [`CreateProductForm.tsx:32`](../../client/src/components/CreateProductForm.tsx#L32)

**The refresh wiring (`App.tsx`)**

- `AuthGate` — owns `refreshKey`, wires `CreateProductForm.onCreated` to `ProductList`'s remount.
  [`App.tsx:21`](../../client/src/App.tsx#L21)

**Test coverage**

- Every I/O matrix row plus the review's new validation/rejection-recovery cases.
  [`CreateProductForm.test.tsx`](../../client/src/components/CreateProductForm.test.tsx)

- The real create→refresh integration through `App`, previously untested (review patch).
  [`App.test.tsx`](../../client/src/App.test.tsx)

**Peripherals**

- `CategoryDto` — client-side mirror of the API's DTO shape.
  [`types.ts`](../../client/src/api/types.ts)
