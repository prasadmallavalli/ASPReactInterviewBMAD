# Epic 2 Context: Authentication & Authorization

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Users can register and log in, and every Product/Category mutation endpoint (built in Epic 1) is closed to unauthenticated callers. A JWT is issued on login and delivered to the browser without ever being readable by client-side JavaScript, and the API only accepts cross-origin requests from the trusted frontend. This closes the biggest credibility gap in the CRUD spine: a portfolio API that anyone could write to.

## Stories

- Story 2.1: User Registration
- Story 2.2: User Login (JWT via httpOnly Cookie)
- Story 2.3: Protect Mutation Endpoints & Scope CORS

## Requirements & Constraints

- Registration accepts email + password; passwords are hashed at rest, never stored or logged in plaintext.
- Registering an already-used email returns a 409/400, not a 500; malformed payloads (missing password, invalid email) return 400 with a structured `ProblemDetails` body.
- Login issues a JWT on valid credentials and returns 401 on invalid credentials.
- Token expiry is enforced server-side; an expired token is rejected on subsequent use, not silently accepted.
- All Product/Category mutation endpoints (POST/PUT/DELETE, from Epic 1) require authentication — unauthenticated requests return 401.
- Read (GET) endpoints stay publicly accessible; authentication scope is mutation-only.
- Mutating requests must carry a server-validated CSRF/anti-forgery token or are rejected.
- Cross-origin requests from any origin other than the configured frontend origin are blocked by CORS.

## Technical Decisions

- **Token storage (AD-5):** the login endpoint issues the JWT as an `httpOnly`, `Secure`, `SameSite` cookie — never in the response body. The React frontend never reads or stores the raw token; this exists specifically to prevent XSS-based token theft (the localStorage failure mode).
- Auth is enforced via `[Authorize]` on controller actions combined with AD-5's cookie flow — this is the project's standing auth convention, not a per-endpoint choice.
- Mutating requests carry a CSRF/anti-forgery token, validated server-side, in addition to the auth cookie (required because cookie-based auth alone is CSRF-exposed).
- All 4xx/5xx responses use RFC 7807 `ProblemDetails`; unhandled exceptions are caught by global middleware and rendered the same way — auth errors should follow this same shape for consistency with Epic 1's endpoints.
- Layering holds for auth too: controllers stay thin and call into Application-layer services; no controller talks to `DbContext` or a user-store repository directly (AD-1/AD-2).
- DI lifetime rule (AD-4) applies to any new auth-related service or repository: `DbContext`-touching components are `Scoped`; only framework-provided singletons (logging, `IConfiguration`) are `Singleton`.
- Stack: ASP.NET Core 10, EF Core 10.x against SQL Server — no new stack elements introduced for this epic beyond ASP.NET Core's built-in JWT/cookie and CORS middleware.

## Cross-Story Dependencies

- Story 2.3 depends on the Product/Category mutation endpoints already existing from Epic 1 — it adds protection to them, it doesn't create them.
- Within the epic, order matters: 2.1 (registration) must work before 2.2 (login) can be exercised end-to-end, and 2.2's working JWT/cookie issuance is a prerequisite for 2.3 (protecting endpoints and verifying 401 behavior).
- Epic 3 (React Frontend) depends on this epic's AD-5 cookie flow: the frontend's API client must send credentials on every request and handle the CSRF token, rather than managing a bearer token itself.
