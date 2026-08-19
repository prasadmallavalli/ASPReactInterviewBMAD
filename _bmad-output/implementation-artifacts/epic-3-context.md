# Epic 3 Context: React Frontend

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

A React app gives users a working UI to list, create, edit, and delete Products against the protected API built in Epics 1-2, with loading and error states surfaced instead of silent failures, and resilient handling of transient network issues. This is the demo surface of the whole project — the piece an interviewer actually clicks through — so it must complete a full create → list → edit → delete cycle without losing auth state on any reload. Scope is Products only; there is no Category management UI in this epic.

## Stories

- Story 3.1: API Client Foundation & Resilience Layer
- Story 3.2: Product List View
- Story 3.3: Create Product
- Story 3.4: Edit Product
- Story 3.5: Delete Product

## Requirements & Constraints

- Every API request from the client automatically includes credentials (the httpOnly auth cookie) — the frontend never reads, stores, or attaches a raw token itself.
- On network failure or a 5xx response, the client retries with exponential backoff, capped at 3 attempts; 4xx responses are never retried (they indicate a client error, not a transient one).
- The product list fetch shows a loading state while in flight and a visible error state on failure (network error or 4xx/5xx) — never a silent failure.
- Create and edit forms show a loading state while submitting, surface field-level or form-level validation errors on a 400 response, and show a visible error state on network/server failure.
- Delete requires confirmation; on failure it shows a visible error state and the item stays in the list (no optimistic removal that silently reverts).
- A full create → list → edit → delete cycle must work end-to-end through the UI without a page reload dropping auth state.
- Scope is Products only for this epic — no Category CRUD UI.

## Technical Decisions

- **Frontend resilience (AD-7):** the API-calling layer is the single place retry logic lives — exponential backoff, max 3 attempts, network/5xx only, never 4xx. Built once in Story 3.1 and reused by every feature call, not reimplemented per-request.
- **Token handling (AD-5 consequence for the client):** the JWT lives only in an httpOnly cookie set by the Epic 2 login endpoint; the client's job is to send credentials on every request (`credentials: 'include'`-style behavior) and attach the CSRF/anti-forgery token on mutating requests — it never parses or stores the JWT itself.
- Error responses from the API follow RFC 7807 `ProblemDetails` for all 4xx/5xx — the client's error-handling/display logic should expect and parse this shape consistently across list/create/edit/delete.
- Structural convention: API client and retry logic live under `client/src/api/`; UI components live under `client/src/components/`.
- Stack: React 19.x with Vite (React + TypeScript template) as the frontend build tool.

## Cross-Story Dependencies

- Story 3.1 (API client + resilience layer) is a prerequisite for 3.2-3.5 — every feature story calls through it rather than issuing raw requests.
- Story 3.2 (Product List View) is a practical prerequisite for exercising 3.3/3.4/3.5, since create/edit/delete all need the list to confirm their effect.
- This epic depends on Epic 2's completed auth flow: the httpOnly cookie issuance (Story 2.2) and CORS/CSRF protection (Story 2.3) must already be in place for the client's credentialed requests and mutation calls to succeed.
- This epic depends on Epic 1's Product CRUD endpoints and DTO shapes being stable, since the UI is built directly against them.
