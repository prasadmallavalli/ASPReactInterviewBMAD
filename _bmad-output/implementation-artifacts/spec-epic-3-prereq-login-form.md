---
title: 'Minimal Login Form (Epic 3 prerequisite)'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '04924445cd8748eb605a009f51b1e96dfe86ff92'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No login UI exists anywhere in Epic 3's story list, yet Story 3.3 (Create Product) requires an authenticated session with a CSRF token — without it, Create/Edit/Delete can never be demoed end-to-end through the browser.

**Approach:** Build a minimal login form and a shared `AuthContext` that checks for an existing session on app mount (`GET /api/auth/me`), exposes authenticated/unauthenticated state to the rest of the app, and gates rendering between the login form and the existing `ProductList` view.

## Boundaries & Constraints

**Always:**
- All calls go through Story 3.1's `apiFetch` — no direct `fetch` calls.
- On app mount, check `GET /api/auth/me` before rendering the login form or `ProductList` — avoids a flash of the login form for an already-authenticated session.
- A successful `POST /api/auth/login` is immediately followed by `GET /api/auth/me` to mint the `XSRF-TOKEN` cookie (Story 2.3: minted by `/me`, never `Login`).
- Login form shows a loading state in flight and a visible inline error on invalid credentials (401) or any other failure — never silent.
- Auth state (`checking`/`authenticated`/`unauthenticated` + current `UserDto`) is exposed via React Context for Stories 3.3–3.5 to consume without prop-drilling.
- New files live under `client/src/auth/`, mirroring `api/`/`components/`.

**Ask First:** none — React Context (built into React, no new dependency) matches this project's established minimal-dependency preference.

**Never:**
- Do not build a registration form — an account must already exist (create one via `curl`/Swagger, as done so far).
- Do not build a logout button/flow — no logout endpoint exists yet (already a deferred gap from Story 2.2).
- Do not build the Create Product form itself — that's the deferred, separately-specced follow-up.
- Do not persist credentials or the raw JWT client-side — the httpOnly cookie is the sole session store (AD-5).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| App mount, session check in flight | `GET /api/auth/me` pending | Brief loading indicator (neither login form nor `ProductList`) | N/A |
| App mount, no existing session | `GET /api/auth/me` → 401 | Login form shown | N/A |
| App mount, valid existing session | `GET /api/auth/me` → 200 | `ProductList` shown directly, login form skipped | N/A |
| Login submitted, valid credentials | `POST /api/auth/login` → 200, then `GET /api/auth/me` → 200 | Transitions to authenticated; `ProductList` renders, no page reload | N/A |
| Login submitted, invalid credentials | `POST /api/auth/login` → 401 | Visible inline error message; form stays editable | N/A |
| Login submitted, network/5xx failure | `apiFetch` returns `ApiFailure` (networkError or 5xx) | Visible inline error message; form stays editable | N/A |
| Login in flight | Submit clicked, request pending | Loading state on the form; submit disabled | N/A |

</frozen-after-approval>

## Code Map

- `client/src/api/client.ts` (`apiFetch`, `ApiResult`) -- reuse directly, no changes
- No shared `UserDto` type client-side yet -- matches `src/Application/DTOs/UserDto.cs` (`Id:int`, `Email:string`)
- `AuthController.cs` (`Login`, `Me`) -- login → 200 `UserDto`/401; `/me` → 200 `UserDto` (mints `XSRF-TOKEN`)/401
- No `client/src/auth/` directory yet -- create fresh
- `client/src/App.tsx` -- currently renders `<ProductList />` directly (Story 3.2) -- wrap in the auth gate

## Tasks & Acceptance

**Execution:**
- [x] `client/src/api/types.ts` -- add `UserDto` (`id`, `email`) -- shared type
- [x] `client/src/auth/AuthContext.tsx` (new) -- checks session on mount via `GET /api/auth/me`, exposes `{ status, user, login }`; `login()` calls `POST /api/auth/login` then re-checks `/me` -- shared auth state
- [x] `client/src/auth/LoginForm.tsx` (new) -- controlled email/password form calling `login()`; loading/error states per the matrix -- the login UI
- [x] `client/src/auth/LoginForm.css` (new) -- minimal styling, no UI library
- [x] `client/src/App.tsx` -- wrap in the auth provider; render checking/`LoginForm`/`ProductList` by status -- gates the app
- [x] `client/src/auth/AuthContext.test.tsx` (new) -- tests for mount-time session check + login-then-recheck flow
- [x] `client/src/auth/LoginForm.test.tsx` (new) -- tests for submit/loading/error states

**Acceptance Criteria:**
- Given valid credentials are submitted, when login succeeds, then `ProductList` renders without a full page reload

## Spec Change Log

## Design Notes

**Why check session on mount:** without it, an already-authenticated user would see a flash of the login form on every page load before `ProductList` appears — an avoidable UX regression.

**Why re-check `/me` right after login:** `Login`'s response confirms credentials were valid, but the `XSRF-TOKEN` cookie Stories 3.3–3.5 need is only minted by `/me` (Story 2.3's verified design) — re-checking isn't redundant, it's the only way to receive that cookie.

**Why no registration form:** keeps this prerequisite minimal per the user's request; an account can be seeded once via `curl`/Swagger, as done throughout this project's manual verification.

## Verification

**Commands:**
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all tests pass, including every `AuthContext`/`LoginForm` I/O matrix row

**Manual checks (if no CLI):**
- Fresh browser/incognito, API+DB running: visit `http://localhost:5173` — confirm the login form appears after a brief check, not `ProductList`.
- Submit valid credentials (register via `curl` first if needed) — confirm `ProductList` renders, no page reload.
- Reload — confirm the session persists (login form skipped) while the cookie is still valid.

## Suggested Review Order

**Auth state (`AuthContext`)**

- Entry point: mount-time session check — now catch-guarded and shape-validated (review patches).
  [`AuthContext.tsx:91`](../../client/src/auth/AuthContext.tsx#L91)

- `login()` — the two-step POST-then-`/me` flow, wrapped in try/catch (review patch).
  [`AuthContext.tsx:127`](../../client/src/auth/AuthContext.tsx#L127)

- `isUserDto` — defensive runtime guard against a malformed `/me` body (review patch), mirroring `ProductList`'s `Array.isArray` guard.
  [`AuthContext.tsx:62`](../../client/src/auth/AuthContext.tsx#L62)

- `useAuth` — the consumption point Stories 3.3–3.5 will use.
  [`AuthContext.tsx:175`](../../client/src/auth/AuthContext.tsx#L175)

**The gate (`App.tsx`)**

- `AuthGate` — status-to-view routing, now with dedicated test coverage closing a real gap (review patch).
  [`App.tsx:11`](../../client/src/App.tsx#L11)

**The form (`LoginForm`)**

- `handleSubmit` — native validation restored (`noValidate` removed) and email trimmed before submit (review patches).
  [`LoginForm.tsx:22`](../../client/src/auth/LoginForm.tsx#L22)

**Test coverage**

- Auth state transitions, the login-then-recheck flow, and the new catch/guard branches.
  [`AuthContext.test.tsx`](../../client/src/auth/AuthContext.test.tsx)

- The full checking/login/authenticated routing through `App`, previously untested.
  [`App.test.tsx`](../../client/src/App.test.tsx)

- Form submit/loading/error behavior.
  [`LoginForm.test.tsx`](../../client/src/auth/LoginForm.test.tsx)

**Peripherals**

- `UserDto` — client-side mirror of the API's DTO shape.
  [`types.ts`](../../client/src/api/types.ts)
