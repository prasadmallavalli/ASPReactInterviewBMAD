---
title: 'User Login (JWT via httpOnly Cookie)'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Registered users (Story 2.1) have no way to establish a session — nothing issues or validates a JWT, and the API has no authentication pipeline at all (`Program.cs` has no `AddAuthentication`/`UseAuthentication`).

**Approach:** Add `UserService.LoginAsync` (verifies credentials, mints a JWT), `POST /api/auth/login` (delivers it as an `httpOnly`/`Secure`/`SameSite=Strict` cookie per AD-5, never in the body), and wire the full JWT bearer authentication pipeline into `Program.cs`. Add a minimal `GET /api/auth/me` (`[Authorize]`) purely as the verification surface for FR-4's "expired token is rejected" criterion — no other endpoint gets `[Authorize]` yet; that's Story 2.3.

## Boundaries & Constraints

**Always:**
- `LoginAsync` looks up by normalized email, verifies via `IPasswordHasher<User>.VerifyHashedPassword`; unknown email and wrong password both collapse to the same generic `InvalidCredentials` → 401 "Invalid credentials" — no signal that distinguishes them (unlike Register's necessarily-revealing 409).
- The JWT is delivered ONLY as a cookie named `access_token` (`HttpOnly`, `Secure`, `SameSite=Strict`, no explicit `Expires` — session-scoped); the raw token string never appears in any response body (AD-5).
- `app.UseAuthentication()` is added before `app.UseAuthorization()` in `Program.cs`; `TokenValidationParameters.ValidateLifetime = true` is set explicitly so FR-4's expiry enforcement is real, not accidental.
- JWT bearer options set `MapInboundClaims = false`; `JwtRegisteredClaimNames.Sub`/`.Email` are used consistently both when minting (`JwtTokenGenerator`) and when reading claims back (`/me`).
- Signing key/issuer/audience/expiry are read from config (`Jwt:SigningKey` etc.) via `IOptions<JwtOptions>`; a missing signing key fails fast at startup, mirroring the existing connection-string null-guard in `Program.cs`.
- `GET api/auth/me` is the minimal `[Authorize]`-protected endpoint needed to prove the login/JWT/cookie round trip actually works end-to-end, and gives Story 2.3 a working `[Authorize]` reference.

**Ask First:** none — extends Epic 1/Story 2.1's established conventions; no new architectural decisions beyond what AD-5/FR-4 already mandate.

**Never:**
- Do not implement CSRF/anti-forgery token issuance or validation here — that is Story 2.3's explicit job.
- Do not add `[Authorize]` to any Epic 1 Category/Product endpoint — that is Story 2.3's job, not this one.
- Do not build a refresh-token or "remember me" flow — the cookie is session-scoped, the JWT itself expires per `Jwt:ExpiryMinutes`; re-login is the only path back in.
- Do not let a login failure reveal whether a specific email is registered — always the same generic "Invalid credentials" message for both wrong-password and unknown-email cases.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path login | Valid, registered email + correct password | 200, body `{ id, email }`, `Set-Cookie: access_token` (`HttpOnly`/`Secure`/`SameSite=Strict`) | N/A |
| Wrong password | Registered email, incorrect password | 401 `ProblemDetails` "Invalid credentials", no cookie set | `Problem(title: "Invalid credentials", statusCode: 401)` |
| Unknown email | Email not registered | 401 `ProblemDetails`, identical message to wrong-password case | Same as above — no enumeration signal |
| Malformed payload | Missing password / malformed email | 400 `ProblemDetails` (model-state) | Automatic via `[ApiController]` |
| Valid cookie on `/api/auth/me` | Prior login's `access_token` cookie present, unexpired | 200, `{ id, email }` read from JWT claims | N/A |
| Expired token on `/api/auth/me` | `access_token` cookie present but past `exp` | 401, no body leak | JWT bearer middleware's default challenge |
| No cookie on `/api/auth/me` | No `access_token` cookie | 401 | JWT bearer middleware's default challenge |

</frozen-after-approval>

## Code Map

- `src/Api/Program.cs:24-65` (DI block), `:94,96` (`UseHttpsRedirection()`/`UseAuthorization()` — `UseAuthentication()` confirmed absent, must be inserted between them) -- add JWT auth wiring
- `src/Application/Services/UserService.cs:22-26` (ctor: `IUnitOfWork`, `IPasswordHasher<User>`), `:41` (`RegisterAsync`) -- mirror shape for `LoginAsync`, extend ctor with `IJwtTokenGenerator`
- `src/Application/Services/IUserService.cs:9-18` (interface), `:26-30` (`UserRegistrationResult` enum) -- mirror for `LoginAsync`/new `UserLoginResult { Success, InvalidCredentials }`
- `src/Api/Controllers/AuthController.cs:22-25` (ctor), `:27-42` (`Register` action's result→status mapping) -- mirror for `Login`/`Me` actions
- `src/Domain/Interfaces/IUserRepository.cs:16` (`GetByEmailAsync`) -- reuse directly, no new repository method needed
- `tests/Application.Tests/Services/UserServiceTests.cs:71-73` (`hasher.VerifyHashedPassword(...)` usage) -- confirms `PasswordVerificationResult { Failed, Success, SuccessRehashNeeded }` shape
- `tests/Application.Tests/Controllers/AuthControllerTests.cs:33-50` (`CreateSut`'s `ProblemDetailsFactory` DI trick) -- reuse/extend for `Login` tests
- `src/Api/appsettings.Development.json:9` (`ConnectionStrings:DefaultConnection` — the one existing config-section example) -- mirror for a new `Jwt` section

## Tasks & Acceptance

**Execution:**
- [x] `src/Api/Api.csproj` -- add `Microsoft.AspNetCore.Authentication.JwtBearer` package -- needed for `AddAuthentication`/`AddJwtBearer`
- [x] `src/Application/Application.csproj` -- add `System.IdentityModel.Tokens.Jwt` package -- needed for `JwtSecurityTokenHandler`
- [x] `src/Application/Services/IJwtTokenGenerator.cs` -- `GenerateToken(User user)` contract + co-located `JwtOptions` POCO (`SigningKey`, `Issuer`, `Audience`, `ExpiryMinutes`) -- contract + config shape
- [x] `src/Application/Services/JwtTokenGenerator.cs` -- implement via `JwtSecurityTokenHandler`, HMAC-SHA256, `Sub`/`Email` claims -- token minting
- [x] `src/Application/DTOs/UserLoginRequestDto.cs` -- `Email` (`[Required, EmailAddress, StringLength(256)]`), `Password` (`[Required, StringLength(256)]`) -- request shape
- [x] `src/Application/Services/IUserService.cs` -- add `LoginAsync(...)` returning `(UserLoginResult, string? Token, UserDto? User)`; `UserLoginResult` enum -- contract
- [x] `src/Application/Services/UserService.cs` -- inject `IJwtTokenGenerator`; implement `LoginAsync` (normalize email, look up, verify hash, mint token on success) -- business logic
- [x] `src/Api/Controllers/AuthController.cs` -- `POST api/auth/login` (sets cookie, returns 200/401) and `GET api/auth/me` (`[Authorize]`, reads `Sub`/`Email` claims, returns `{ id, email }`) -- endpoints
- [x] `src/Api/Program.cs` -- `AddAuthentication().AddJwtBearer(...)` (cookie-reading `OnMessageReceived`, `ValidateLifetime = true`, `MapInboundClaims = false`), `Configure<JwtOptions>(...)`, `app.UseAuthentication()` before `app.UseAuthorization()` -- pipeline wiring
- [x] `src/Api/appsettings.Development.json` -- add `Jwt:SigningKey`/`Issuer`/`Audience`/`ExpiryMinutes` (dev-only values) -- config
- [x] `tests/Application.Tests/Services/UserServiceTests.cs` -- add `LoginAsync` tests: correct credentials, wrong password, unknown email -- test the service-level I/O matrix
- [x] `tests/Application.Tests/Controllers/AuthControllerTests.cs` -- add `Login` tests: success sets cookie + 200, invalid credentials → 401 -- test the controller-level I/O matrix
- [x] `tests/Application.Tests/Services/JwtTokenGeneratorTests.cs` -- generate a token with a past expiry, assert `JwtSecurityTokenHandler.ValidateToken` with `ValidateLifetime=true` rejects it -- automated coverage of FR-4's expiry-enforcement mechanism

**Acceptance Criteria:**
- Given valid credentials, when POSTed to `/api/auth/login`, then the JWT is issued as an `httpOnly`, `Secure`, `SameSite` cookie — never in the response body
- Given invalid credentials, when POSTed, then a 401 is returned
- Given an expired token, when used on a subsequent request to `/api/auth/me`, then it's rejected, not silently accepted

### Review Findings

- [x] [Review][Patch] 401 responses from the JWT bearer challenge bypass the RFC 7807 `ProblemDetails` envelope [src/Api/Program.cs] — verified empirically: `curl` against `GET /api/auth/me` with no cookie returns `content-length: 0`, no body at all. Contradicts `epic-2-context.md`'s explicit requirement that "All 4xx/5xx responses use RFC 7807 `ProblemDetails`... auth errors should follow this same shape for consistency with Epic 1's endpoints." `AddProblemDetails()`/`UseExceptionHandler()` don't reach a bodyless challenge the JWT bearer middleware writes directly. Applied: added `JwtBearerEvents.OnChallenge` writing a `ProblemDetails` body via `IProblemDetailsService`; re-verified with `curl` — response now carries `application/problem+json` with `{ type, title, status, traceId }`.
- [x] [Review][Patch] `OnMessageReceived` doesn't block the default `Authorization: Bearer` header fallback when the `access_token` cookie is absent [src/Api/Program.cs:167-176] — it only sets `context.Token` when the cookie is present; when absent it falls through without calling `context.NoResult()`/`context.Fail()`, so `JwtBearerHandler`'s standard header-based extraction still applies. Contradicts the code's own comment: "the JWT travels only as the httpOnly access_token cookie... never as an Authorization header" (AD-5). Flagged by edge-case-hunter. Applied: `else { context.NoResult(); }` added.
- [x] [Review][Patch] `TokenValidationParameters` never sets `ClockSkew`, leaving the library's default 5-minute leeway [src/Api/Program.cs:155-164] — an expired token is still accepted for up to 5 minutes past its `exp` claim, in tension with FR-4 ("expired token is rejected... not silently accepted") and this spec's own emphasis on `ValidateLifetime = true` being "a deliberate, visible decision, not an accident of the default." Flagged by edge-case-hunter. Applied: `ClockSkew = TimeSpan.Zero` added.
- [x] [Review][Patch] JWT startup config guard clauses have no test forcing any of them to fire [src/Api/Program.cs:113-137] — `SigningKey` length, `Issuer`, `Audience`, `ExpiryMinutes <= 0` guards all exist, but every test that boots the app uses `appsettings.Development.json`'s already-valid values. Verification-gap demonstrated that weakening or deleting any one guard would not fail any current test. Applied: added `JwtStartupValidationTests` (theory, 4 cases), using environment variables to override config (the only source visible to guards that run before `builder.Build()` — confirmed empirically that `WithWebHostBuilder(...).ConfigureAppConfiguration(...)` overrides are invisible to them). Added a `WebApplicationFactory` xUnit collection (`DisableParallelization = true`) across all `WebApplicationFactory<Program>`-based test classes to prevent the env-var mutation from contaminating concurrently-running classes.
- [x] [Review][Patch] `AuthController.Me()`'s malformed/missing-claim rejection branch (`int.TryParse` failure or null email → `Unauthorized()`) has zero test coverage [tests/Application.Tests/Controllers/AuthControllerTests.cs] — every existing test (unit and integration) supplies either a fully-valid claim set or no token at all; verification-gap demonstrated the guard could be silently dropped or inverted with no test catching it. Flagged independently by blind-hunter and verification-gap. Applied: added `Me_NonNumericSubClaim_ReturnsUnauthorized` and `Me_MissingEmailClaim_ReturnsUnauthorized`.
- [x] [Review][Defer] `SameSite=Strict` on `access_token` may not survive a genuinely cross-domain (not just cross-port) frontend/API deployment [src/Api/Controllers/AuthController.cs] — deferred, pre-existing design choice that works correctly for the current same-site local-dev setup (`localhost` at different ports); worth revisiting only if frontend and API ever land on different registrable domains in a real deployment.

## Spec Change Log

## Design Notes

**Token expiry default:** no PRD/architecture text specifies a duration, so `Jwt:ExpiryMinutes` defaults to 60 in `appsettings.Development.json` — a config value, cheaply tunable later, not an architectural commitment.

**Why `GET api/auth/me` exists:** FR-4's "an expired token is rejected on subsequent use" criterion needs a real `[Authorize]`-protected endpoint to prove the pipeline works — a raw token-validation unit test alone wouldn't demonstrate the middleware itself is wired correctly. `/me` is the minimal, single-purpose endpoint that does this without prematurely protecting Epic 1's mutation endpoints (Story 2.3's job).

**Why the cookie has no explicit `Expires`:** making it session-scoped (cleared when the browser closes) avoids maintaining two separate expiry values (cookie `Expires` vs. JWT `exp` claim) that could drift out of sync. The JWT's own `exp` claim remains the actual authority server-side; the cookie's lack of `Expires` is only a client-side convenience default. A "remember me" flow is explicitly out of scope (see Never).

**Why `JwtTokenGenerator` lives in Application, not Api:** it depends only on `IOptions<JwtOptions>` (a plain POCO) and the `System.IdentityModel.Tokens.Jwt` library — no EF Core, no ASP.NET hosting types — so it satisfies AD-2 the same way Story 2.1's `IPasswordHasher<User>` usage did. Config binding (`Configure<JwtOptions>`) still happens only in `Program.cs`, the composition root.

## Verification

**Commands:**
- `dotnet build` -- expected: solution builds with no errors
- `dotnet test` -- expected: new `LoginAsync`/`Login` controller/`JwtTokenGenerator` tests pass alongside all existing tests

**Manual checks (if no CLI):**
- `POST /api/auth/login` with correct credentials — confirm 200, `{ id, email }` body, and a `Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict` header
- `POST /api/auth/login` with wrong password and with an unregistered email — confirm both return an identical 401 `ProblemDetails` body
- `GET /api/auth/me` with the cookie from a successful login — confirm 200 with matching `{ id, email }`
- `GET /api/auth/me` with no cookie, and with a manually crafted expired token cookie — confirm both return 401

## Suggested Review Order

**Login business logic**

- Entry point: normalizes email, looks up the user, verifies via `IPasswordHasher<User>.VerifyHashedPassword`, mints a token only on success.
  [`UserService.cs:74`](../../src/Application/Services/UserService.cs#L74)

- Two-outcome result (`Success`/`InvalidCredentials`) deliberately collapses unknown-email and wrong-password into one signal — no enumeration path.
  [`IUserService.cs:47`](../../src/Application/Services/IUserService.cs#L47)

- Mints the HMAC-SHA256 JWT via `JwtSecurityTokenHandler`, `Sub`/`Email` claims, expiry from validated config.
  [`JwtTokenGenerator.cs:28`](../../src/Application/Services/JwtTokenGenerator.cs#L28)

**API surface**

- `Login`: sets the `access_token` cookie (`HttpOnly`/`Secure`/`SameSite=Strict`, no `Expires`), body is `{ id, email }` only — the raw token never crosses into the response.
  [`AuthController.cs:54`](../../src/Api/Controllers/AuthController.cs#L54)

- `Me`: the minimal `[Authorize]`-protected endpoint proving the login/JWT/cookie round trip; post-review, reads claims defensively (`TryParse` + null-check → 401) instead of trusting them blindly.
  [`AuthController.cs:90`](../../src/Api/Controllers/AuthController.cs#L90)

**Auth pipeline wiring**

- `Jwt:*` config is read once into a single validated `JwtOptions` (post-review: `SigningKey` length, `ExpiryMinutes > 0` now fail fast at startup instead of silently minting dead-on-arrival tokens).
  [`Program.cs:79`](../../src/Api/Program.cs#L79)

- `AddAuthentication`/`AddJwtBearer`: `OnMessageReceived` reads the cookie instead of the `Authorization` header (AD-5), `MapInboundClaims=false`, `ValidateLifetime=true` explicit.
  [`Program.cs:124`](../../src/Api/Program.cs#L124)

- `UseAuthentication()` inserted before `UseAuthorization()` — the gap that made `[Authorize]` a no-op didn't exist until this line landed.
  [`Program.cs:182`](../../src/Api/Program.cs#L182)

- `public partial class Program;` marker added post-review, purely to make the top-level-statements `Program` class visible to `WebApplicationFactory<Program>` in tests.
  [`Program.cs:193`](../../src/Api/Program.cs#L193)

**Peripherals**

- Covers `LoginAsync`'s three outcomes, including proof that a token is minted only on the success path.
  [`UserServiceTests.cs:125`](../../tests/Application.Tests/Services/UserServiceTests.cs#L125)

- Covers the controller's cookie-setting and 401 branches with a mocked `IUserService`.
  [`AuthControllerTests.cs:96`](../../tests/Application.Tests/Controllers/AuthControllerTests.cs#L96)

- Added post-review: drives the *real* middleware pipeline via `WebApplicationFactory<Program>` — the piece no mocked-service test could prove.
  [`AuthPipelineTests.cs:57`](../../tests/Application.Tests/Integration/AuthPipelineTests.cs#L57)
