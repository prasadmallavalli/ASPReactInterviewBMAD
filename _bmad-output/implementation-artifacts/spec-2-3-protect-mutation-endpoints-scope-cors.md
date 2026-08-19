---
title: 'Protect Mutation Endpoints & Scope CORS'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic 1's Category/Product mutation endpoints (Create/Update/Delete) are wide open — Story 2.2 built the full JWT/cookie login pipeline, but nothing actually gates the endpoints it exists to protect, no CORS policy limits which origins can call the API, and no CSRF/anti-forgery mechanism exists yet despite cookie-based auth requiring one (AD-5).

**Approach:** Add `[Authorize]` to Category/Product Create/Update/Delete actions (GET stays public). Add ASP.NET Core's built-in `IAntiforgery` (part of the shared framework, no new package) validated globally via `[AutoValidateAntiforgeryToken]` — which only checks unsafe HTTP methods, exempting GET automatically. Issue the anti-forgery token as a non-httpOnly cookie during login (JS-readable, echoed back via a `X-CSRF-TOKEN` header on mutations). Add a CORS policy scoped to one configurable frontend origin with `AllowCredentials()` (required for cookies to cross origins).

## Boundaries & Constraints

**Always:**
- `[Authorize]` is added only to Create/Update/Delete actions on `CategoriesController`/`ProductsController` — GET actions on both remain unauthenticated (FR-4's mutation-only scope).
- CSRF validation uses `[AutoValidateAntiforgeryToken]` applied globally via an `AddControllers` filter — it only validates POST/PUT/DELETE/PATCH, so GET endpoints need no explicit exemption.
- `AuthController.Register` and `Login` get `[IgnoreAntiforgeryToken]` explicitly: CSRF protection guards an existing authenticated session, and a client cannot possess a CSRF token before that session exists — validating it here would create a chicken-and-egg deadlock. `Login` also calls `IAntiforgery.GetAndStoreTokens(HttpContext)` after setting the `access_token` cookie, so a successful login leaves the client with both cookies it needs for subsequent authenticated, CSRF-protected mutations.
- The anti-forgery cookie (`XSRF-TOKEN`) is deliberately **not** `HttpOnly` — the SPA's JS must read it to echo it back in the `X-CSRF-TOKEN` header; it still gets `Secure` + `SameSite=Strict` since the token value itself isn't a bearer credential (AD-5).
- CORS policy uses `WithOrigins(<configured origin>)` (never `AllowAnyOrigin()`) + `AllowCredentials()` — required together, since `AllowCredentials()` is rejected by the CORS spec when combined with a wildcard origin, and cookies won't cross origins without it.
- `Cors:FrontendOrigin` is read from config (default `http://localhost:5173`, Vite's dev port, in `appsettings.Development.json`) and fails fast at startup if missing, mirroring the existing `Jwt:*`/connection-string null-guard pattern.
- `app.UseCors(...)` is inserted between `UseHttpsRedirection()` and `UseAuthentication()` — the documented required order for CORS to apply before auth/authorization short-circuits a request.

**Ask First:** none — CSRF mechanism reuses ASP.NET Core's built-in `IAntiforgery` (ships in the shared framework, zero new dependencies), matching this project's established preference for framework-provided pieces over third-party libraries (`PasswordHasher<User>`, `JwtBearer`).

**Never:**
- Do not apply `[Authorize]` to any GET action — read endpoints stay public per this story's own AC.
- Do not validate CSRF tokens on `/api/auth/register` or `/api/auth/login` — no session exists yet to protect (see Always).
- Do not use `AllowAnyOrigin()` — defeats the entire point of scoping CORS to the frontend.
- Do not build a full SPA-facing "get CSRF token" bootstrap endpoint — token issuance piggybacks on login, since no unauthenticated flow needs to mutate anything.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unauthenticated mutation | POST/PUT/DELETE to `/api/products` or `/api/categories`, no `access_token` cookie | 401 | JWT bearer middleware's default challenge |
| Authenticated GET | GET `/api/products`/`/api/categories`, no cookie at all | 200 (unchanged) | N/A |
| Authenticated mutation, missing/invalid CSRF token | Valid `access_token` cookie, `X-CSRF-TOKEN` header missing or not matching the `XSRF-TOKEN` cookie | 400 | `AutoValidateAntiforgeryTokenAttribute`'s default rejection |
| Authenticated mutation, valid CSRF token | Valid `access_token` cookie + matching `X-CSRF-TOKEN` header/`XSRF-TOKEN` cookie pair | Normal success response (200/201/204, unchanged from Epic 1) | N/A |
| Disallowed cross-origin request | Request carries `Origin: https://evil.example.com` | No `Access-Control-Allow-Origin` response header (browser enforces the block) | CORS middleware |
| Allowed cross-origin request | Request carries `Origin: <configured Cors:FrontendOrigin>` | `Access-Control-Allow-Origin` header present, matching the origin | N/A |

</frozen-after-approval>

## Code Map

- `src/Api/Controllers/CategoriesController.cs:43` (`Create`), `:52` (`Update`), `:64` (`Delete`) -- add `[Authorize]` to each
- `src/Api/Controllers/ProductsController.cs:45` (`Create`), `:66` (`Update`), `:81` (`Delete`) -- add `[Authorize]` to each
- `src/Api/Controllers/AuthController.cs:91` (`[Authorize]` on `Me()`, the only existing precedent) -- add `[IgnoreAntiforgeryToken]` to `Register`/`Login`; inject `IAntiforgery`, call `GetAndStoreTokens(HttpContext)` in `Login` after the `access_token` cookie is set
- `src/Api/Program.cs:29` (`AddControllers()`, no options lambda today) -- add `options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute())`
- `src/Api/Program.cs:151` (`AddAuthorization()`, end of DI block) -- add `AddCors(...)` and `AddAntiforgery(...)` alongside it
- `src/Api/Program.cs:180-182` (`UseHttpsRedirection()` then `UseAuthentication()`) -- insert `app.UseCors(...)` between them
- `src/Api/appsettings.Development.json:11-16` (`Jwt` section — the pattern to mirror) -- add a new `Cors:FrontendOrigin` key
- `tests/Application.Tests/Integration/AuthPipelineTests.cs:36,48-55` (`WebApplicationFactory<Program>` + `WithWebHostBuilder` pattern) -- reuse directly for new mutation-endpoint and CORS-header tests; no DB needed for the 401 and CORS-header cases (rejection happens before any DB-touching code runs)

## Tasks & Acceptance

**Execution:**
- [x] `src/Api/Controllers/CategoriesController.cs` -- add `[Authorize]` to `Create`/`Update`/`Delete` -- gate mutations
- [x] `src/Api/Controllers/ProductsController.cs` -- add `[Authorize]` to `Create`/`Update`/`Delete` -- gate mutations
- [x] `src/Api/Controllers/AuthController.cs` -- inject `IAntiforgery`; add `[IgnoreAntiforgeryToken]` to `Register`/`Login`; issue the CSRF cookie via `GetAndStoreTokens(HttpContext)` -- CSRF token issuance + auth-endpoint exemption (see Spec Change Log: issuance moved from `Login` to `Me()`)
- [x] `src/Api/Program.cs` -- `AddCors` (named policy, `WithOrigins(corsOrigin)`, `AllowCredentials()`, `AllowAnyHeader()`, `AllowAnyMethod()`); `AddAntiforgery` (`HeaderName = "X-CSRF-TOKEN"`, `Cookie.SecurePolicy = Always`, `Cookie.SameSite = Strict`); `AddControllers(options => options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()))`; fail-fast read of `Cors:FrontendOrigin`; `app.UseCors(...)` between `UseHttpsRedirection()` and `UseAuthentication()` -- pipeline wiring
- [x] `src/Api/appsettings.Development.json` -- add `Cors:FrontendOrigin` = `http://localhost:5173` -- config
- [x] `tests/Application.Tests/Integration/MutationEndpointsAuthTests.cs` -- unauthenticated POST/PUT/DELETE to `/api/products` and `/api/categories` → 401; unauthenticated GET to both → 200 -- automated coverage, no DB needed
- [x] `tests/Application.Tests/Integration/CorsPolicyTests.cs` -- request with the configured frontend `Origin` header → `Access-Control-Allow-Origin` present and matching; request with a disallowed `Origin` → header absent -- automated coverage, no DB needed

**Acceptance Criteria:**
- Given an unauthenticated request, when it hits a Create/Update/Delete endpoint from Epic 1, then a 401 is returned
- Given a mutating request (POST/PUT/DELETE), when it lacks a valid CSRF/anti-forgery token, then it's rejected server-side (AD-5)
- Given a request from an origin other than the configured frontend origin, when it arrives, then CORS blocks it
- Given Read (GET) endpoints, when accessed without authentication, then they remain publicly accessible per FR4's mutation-only scope

## Spec Change Log

- **CSRF token issuance moved from `Login` to `Me()`.** The frozen Intent/Boundaries text calls for `Login` to call `IAntiforgery.GetAndStoreTokens(HttpContext)` right after setting the `access_token` cookie. Verified empirically (real HTTPS run) that this doesn't work: `DefaultAntiforgery` unconditionally binds every issued token pair to `HttpContext.User`'s identity *at issuance time*, and the request running `Login` is itself unauthenticated (no `access_token` cookie on the way in — the same reason `[IgnoreAntiforgeryToken]` is needed on `Login` at all). A token minted mid-`Login` is bound to "no identity," while every later mutation request *is* authenticated, so every subsequent mutation failed CSRF validation with "the provided antiforgery token was meant for a different claims-based user than the current user," regardless of the header sent. Fix: `GetAndStoreTokens(HttpContext)` now runs in the pre-existing `[Authorize]`-protected `GET /api/auth/me` instead, which only ever executes once `HttpContext.User` is the same identity every later mutation presents. Also dropped the originally-listed `AddAntiforgery` options `Cookie.Name = "XSRF-TOKEN"` / `Cookie.HttpOnly = false`: those would rename the framework's own internal "cookie token" cookie and expose it to JS, which breaks the token pair (the cookie-token and request-token halves are cryptographically related but not interchangeable — same-name/JS-readable produces "the cookie token and the request token were swapped"). The framework-managed antiforgery cookie keeps its default name and stays `HttpOnly`; a distinct, JS-readable `XSRF-TOKEN` cookie holding `tokens.RequestToken` is set explicitly in `Me()` instead, matching what `AutoValidateAntiforgeryTokenAttribute` expects in the `X-CSRF-TOKEN` header. Net effect for the frontend: it must call `GET /api/auth/me` once after login (before its first mutation) to receive the `XSRF-TOKEN` cookie — a one-call addition to Epic 3's client bootstrap, not a scope change to this story's endpoints. Behavior against the I/O matrix is unchanged (verified manually end-to-end: register → login → `/me` → mutation without header → 400 → mutation with header → 200/201/204) and both new automated test files pass unmodified from the spec's Code Map.

## Design Notes

**Why `IAntiforgery` over a hand-rolled CSRF scheme:** it's part of the ASP.NET Core shared framework already referenced by `Microsoft.NET.Sdk.Web` — zero new NuGet packages, same reasoning already applied to `PasswordHasher<User>` (2.1) and `JwtBearer` (2.2). `[AutoValidateAntiforgeryToken]`'s built-in safe-method exemption (GET/HEAD/OPTIONS/TRACE) maps exactly onto "mutation-only" without per-action annotation.

**Why token issuance piggybacks on `Login`:** the only place a client legitimately needs a CSRF token is right after establishing a session — there's no unauthenticated flow in this app that mutates anything, so a separate bootstrap endpoint would be unused surface area.

**Why `Register`/`Login` are exempted from CSRF validation:** `[AutoValidateAntiforgeryToken]` applied globally would otherwise also gate these two POST endpoints, but CSRF protection exists to stop a malicious site from riding an *existing* authenticated session — before login, there is no session to ride, and requiring a token the client can't yet have would make login impossible.

**CORS `AllowAnyHeader()`/`AllowAnyMethod()`:** kept permissive (vs. hand-listing every header/verb) since the origin restriction plus `AllowCredentials()` is what actually matters here — no FR/NFR asks for tighter method/header scoping, and Epic 3's frontend isn't built yet to know its exact request shape.

## Verification

**Commands:**
- `dotnet build` -- expected: solution builds with no errors
- `dotnet test` -- expected: new mutation-auth/CORS integration tests pass alongside all existing tests

**Manual checks (if no CLI):**
- Log in, then POST/PUT/DELETE to `/api/products`/`/api/categories` with the `access_token` cookie but no `X-CSRF-TOKEN` header — confirm 400
- Repeat with the correct `X-CSRF-TOKEN` header (from the `XSRF-TOKEN` cookie set at login) — confirm the mutation succeeds as it did before this story
- Confirm `GET /api/products`/`/api/categories` still work with zero cookies

## Suggested Review Order

**CSRF token lifecycle (the story's core design decision)**

- Why issuance moved from `Login` to `Me()` — identity-binding pitfall and the fix, explained in full.
  [`AuthController.cs:128`](../../src/Api/Controllers/AuthController.cs#L128)

- `Me()` mints and sets the JS-readable `XSRF-TOKEN` cookie once the caller is authenticated.
  [`AuthController.cs:161`](../../src/Api/Controllers/AuthController.cs#L161)

- `Login`/`Register` opt out of global CSRF validation — no session exists yet to protect.
  [`AuthController.cs:90`](../../src/Api/Controllers/AuthController.cs#L90)

- `RegisterLoginMeThenMutate_NoCsrfHeader400_CorrectCsrfHeaderSucceeds` — the regression test for the identity-binding fix.
  [`CsrfProtectionTests.cs:59`](../../tests/Application.Tests/Integration/CsrfProtectionTests.cs#L59)

**Pipeline wiring (Program.cs)**

- `AddMvcCore().AddViews()` — the non-obvious dependency `AutoValidateAntiforgeryTokenAttribute` needs to resolve from DI.
  [`Program.cs:56`](../../src/Api/Program.cs#L56)

- Global CSRF filter applied via `AddControllers` options, not per-action.
  [`Program.cs:37`](../../src/Api/Program.cs#L37)

- `AddAntiforgery` — deliberately does not rename/expose the framework's own cookie token.
  [`Program.cs:223`](../../src/Api/Program.cs#L223)

- `Cors:FrontendOrigin` fail-fast read, mirroring the existing `Jwt:*`/connection-string guard pattern.
  [`Program.cs:186`](../../src/Api/Program.cs#L186)

- `AddCors` policy — `WithOrigins` + `AllowCredentials()`, never `AllowAnyOrigin()`.
  [`Program.cs:194`](../../src/Api/Program.cs#L194)

- `UseCors` placement between `UseHttpsRedirection()` and `UseAuthentication()` — required order.
  [`Program.cs:262`](../../src/Api/Program.cs#L262)

**Mutation gating**

- `[Authorize]` added to Create/Update/Delete; GET stays public.
  [`CategoriesController.cs:45`](../../src/Api/Controllers/CategoriesController.cs#L45)

- Same pattern on the Product side.
  [`ProductsController.cs:47`](../../src/Api/Controllers/ProductsController.cs#L47)

**Peripherals**

- `Cors:FrontendOrigin` config value.
  [`appsettings.Development.json:17`](../../src/Api/appsettings.Development.json#L17)

- 401-on-unauthenticated-mutation / 200-on-unauthenticated-GET coverage.
  [`MutationEndpointsAuthTests.cs`](../../tests/Application.Tests/Integration/MutationEndpointsAuthTests.cs)

- Allowed vs. disallowed `Origin` header coverage.
  [`CorsPolicyTests.cs`](../../tests/Application.Tests/Integration/CorsPolicyTests.cs)
