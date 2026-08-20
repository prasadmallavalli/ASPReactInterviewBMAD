# ADR-003: JWT Delivered via httpOnly Cookie, Not localStorage

Status: Accepted
Date: 2026-08-19 (Story 2.2) · Deciders: Prasadmallavalli
Related: CSRF/anti-forgery mechanism from Story 2.3 (see Consequences) has no ADR of its own yet — logged as a gap in [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md).

## Context

FR-4/FR-5 required a token-based session with a defensible storage strategy. Story 2.2 implemented `POST /api/auth/login`: on success it mints a JWT (`JwtTokenGenerator`, HMAC-SHA256) and delivers it only via `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict` — the response body is `{ id, email }` only, and the raw token never appears in any response the frontend can read. This is the token-storage candidate the product brief flagged as "ADR-003" ([PRD `addendum.md`](../../_bmad-output/planning-artifacts/prds/prd-ASPFullStackBMAD-2026-08-18/addendum.md): "brief's ADR-003 candidate (httpOnly cookie vs. localStorage)").

## Decision

The login endpoint issues the JWT exclusively as an `httpOnly`, `Secure`, `SameSite=Strict` cookie. React never reads or stores the raw token string. The cookie is session-scoped (no explicit `Expires`) — the JWT's own `exp` claim is the real authority server-side.

## Alternatives

- **`localStorage`/`sessionStorage`.** The common SPA pattern: store the token client-side, attach it manually as an `Authorization: Bearer` header. Rejected because any script that runs in the page — including an injected XSS payload — can read `localStorage` and exfiltrate the token wholesale. An `httpOnly` cookie is invisible to JavaScript by design, closing that specific theft vector.

## Consequences

- No client-side JavaScript ever touches the raw token, eliminating the most common SPA credential-theft path.
- **Not a free lunch:** an `httpOnly` cookie is sent automatically by the browser on every request to the API's origin, which reopens CSRF exposure that a manually-attached bearer token doesn't have. `SameSite=Strict` covers most of that gap on its own, but Story 2.3 still had to add a dedicated CSRF/anti-forgery token mechanism for mutating requests — this decision traded one class of vulnerability (XSS token theft) for another (CSRF), and needed a second, separate control to close the new gap.
- CSRF had to be solved separately (Story 2.3's `[IgnoreAntiforgeryToken]`/anti-forgery-token wiring); `SameSite=Strict` alone was doing that mitigation work as an unstated interim measure before Story 2.3 landed ([`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) flags this gap in documentation, not behavior).
- The cookie approach is browser-specific. A future non-browser client (native mobile app, CLI, another service) can't rely on a cookie jar and would need a different token-delivery mechanism — this decision doesn't generalize past "a React SPA talking to this API from the same registrable domain."
- No refresh-token or "remember me" flow exists; the session ends when the browser closes or the JWT expires, whichever comes first. Re-login is the only way back in.
