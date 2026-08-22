# Deferred Work

Append-only ledger of real, non-blocking findings surfaced during story review. Each entry names its source spec and why it was deferred rather than fixed inline or escalated.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `Category.Name`/`Product.Name` have no `HasMaxLength` constraint (mapped `nvarchar(max)`), leaving no data-integrity bound and making future indexing awkward.
  evidence: Real gap surfaced by blind-hunter review; not spec-mandated for this scaffold story, so fixing it now would exceed the story's schema-only scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: No unique index/constraint on `Category.Name` — duplicate category names are currently allowed.
  evidence: Surfaced by both blind-hunter and edge-case-hunter independently. Whether duplicates should be allowed is a product decision the PRD/architecture never addressed, not a coding defect.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `docker-compose.yml` pins the SQL Server image to the mutable tag `2022-latest` rather than a specific version/digest, so the dev environment isn't fully reproducible over time.
  evidence: Real reproducibility gap; low severity for a solo local-dev setup, safe to revisit later.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: The four `.csproj` files repeat the same `TargetFramework`/`Nullable`/`ImplicitUsings` `PropertyGroup` verbatim with no root `Directory.Build.props` centralizing them.
  evidence: Cosmetic DRY concern from blind-hunter review; no correctness impact, cheap to consolidate later.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: No `global.json` pins the .NET SDK version, so which SDK resolves `net10.0` depends on whatever is locally installed.
  evidence: Real reproducibility gap flagged by blind-hunter; non-blocking for a single-developer machine.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: The Api exposes no health-check endpoint — only the `mssql` Docker container has a healthcheck.
  evidence: Reasonable operational hardening surfaced by blind-hunter; not required by any FR/NFR for this local-dev-only project.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: No README/setup documentation describes the dev workflow (bring up `docker compose`, apply the migration, run the Api).
  evidence: Legitimate onboarding gap from blind-hunter review; non-blocking, worth adding once the workflow stabilizes across more stories.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `ICategoryRepository`/`IProductRepository` expose only basic CRUD — no filtered query method (e.g. `GetByCategoryIdAsync`), which Story 1.2/1.3 will likely need.
  evidence: Blind-hunter flagged a predictable future interface change; premature to guess the exact shape before Stories 1.2/1.3 define their actual query needs.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `Product.Category` is a required navigation property that will be null at runtime if a future query loads a `Product` without `.Include(p => p.Category)` — implementation guidance for Stories 1.2/1.3's query methods, not a scaffold defect.
  evidence: Edge-case-hunter flagged the reachable null path; inherent to standard EF Core lazy-loading-off behavior, addressed by consistent `.Include` usage in the repository implementations landing in later stories.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-category-crud.md`
  summary: `CategoryService.DeleteAsync` has a narrow check-then-act race — `HasProductsAsync` can pass, then a `Product` insert lands before `SaveChangesAsync` commits the delete. The DB's `DeleteBehavior.Restrict` FK (Story 1.1) still prevents actual data loss, but the request would surface as an unhandled 500 (now shaped as ProblemDetails, since this review added `UseExceptionHandler()`) instead of a clean 409.
  evidence: Flagged independently by blind-hunter, edge-case-hunter, and verification-gap. A correct fix means catching `DbUpdateException` and translating it to the 409 result — but that exception type lives in `Microsoft.EntityFrameworkCore`, and `CategoryService` sits in Application, which AD-2 forbids from depending on EF Core directly. The proper fix is a Domain-level exception type that Infrastructure translates the EF exception into, which is a small design decision, not a trivial patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-category-crud.md`
  summary: No optimistic concurrency control (no `RowVersion`/ETag) on `Update`/`Delete` — two concurrent `PUT`s silently overwrite each other, and a concurrent update/delete pair isn't detected either.
  evidence: Flagged independently by blind-hunter and edge-case-hunter (two distinct race scenarios). Real gap, but adding a concurrency token is a schema change (new migration) with no FR/NFR currently requiring it for this single-developer local project.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-category-crud.md`
  summary: `CategoryRequestDto.Name` accepts whitespace-only values (passes `[Required]`/`[StringLength]`), and nothing trims/normalizes the name before persistence, so `"Widgets"` and `"Widgets "` are treated as distinct categories.
  evidence: Blind-hunter flagged both the missing trim and the missing normalization; same root cause (no name-normalization step), low severity, cheap to add alongside the already-deferred uniqueness check.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-category-crud.md`
  summary: `CategoryService.GetAllAsync`/`CategoryRepository.GetAllAsync` have no `OrderBy`, so the list endpoint's row order is not guaranteed to be stable across calls.
  evidence: Blind-hunter flagged the nondeterminism; non-blocking now, but will need addressing whenever pagination/sorting lands.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-category-crud.md`
  summary: `CategoriesController` actions have no `[ProducesResponseType]` attributes, so the OpenAPI spec `AddOpenApi()` generates only documents the default success response, not the 404/409/400 outcomes.
  evidence: Blind-hunter flagged the documentation gap; no consumer reads the generated OpenAPI spec yet at this stage of the build.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: `ProductService.CreateAsync`/`UpdateAsync` have the same check-then-act race as Story 1.2's delete: the `CategoryId` existence check can pass, then the referenced `Category` is deleted before `SaveChangesAsync` commits, surfacing as an unhandled `DbUpdateException` (500) instead of a clean 400.
  evidence: Flagged independently by blind-hunter and edge-case-hunter, for both Create and Update. Same architectural constraint as the Story 1.2 delete race: catching `DbUpdateException` requires `CategoryService`/`ProductService` (Application) to depend on `Microsoft.EntityFrameworkCore`, which AD-2 forbids. Needs a Domain-level exception type Infrastructure translates into — a small design decision, not a trivial patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: No `GET /api/products?categoryId=` filter endpoint, even though "list products in a category" is a natural catalog operation the service already has the data to support.
  evidence: Blind-hunter flagged a real, cheap-to-add feature gap; not in Story 1.3's approved scope (I/O matrix has no such row), so adding it now would be scope creep beyond the approved spec.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: `ProductService.GetAllAsync`/`ProductRepository.GetAllAsync` have no `OrderBy`, so list order isn't guaranteed stable across calls — the Product-side twin of the same gap already logged for Category.
  evidence: Blind-hunter flagged the nondeterminism; non-blocking now, same reasoning as the Category entry, will need addressing alongside pagination.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: `ProductRequestDto.Name`'s `[Required]` accepts whitespace-only strings (e.g. `"   "`) — the Product-side twin of the same gap already logged for `CategoryRequestDto`.
  evidence: Blind-hunter flagged the missing trim/normalization; low severity, cheap to add alongside the already-deferred Category fix in one pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: `[Range(0.01, 1000000)]` on `Price` bounds the value but not its decimal scale — a client can send e.g. `12.3456789`, risking silent truncation against the `decimal(18,2)` column rather than a clean validation failure.
  evidence: Blind-hunter flagged the precision gap; low likelihood in practice (no UI yet drives arbitrary-precision input), cheap to add a custom validation attribute later.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-product-crud.md`
  summary: `ProductWriteResult` is shared between `CreateAsync` and `UpdateAsync`, but `CreateAsync` can never actually return `NotFound` — one enum covering two methods with different reachable-value subsets is a latent footgun for future maintainers.
  evidence: Blind-hunter flagged the design smell; confirmed `CreateAsync` only returns `CategoryNotFound`/`Success` in practice. Cosmetic/maintainability concern, not a functional defect — safe to revisit when Story 1.6's tests are being written.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-correlation-id-structured-logging.md`
  summary: A client-supplied `X-Correlation-Id` is trusted and echoed back verbatim with no format/length validation; a duplicated header collapses to a comma-joined `StringValues.ToString()`; a whitespace-only value is treated as present rather than absent.
  evidence: Flagged by blind-hunter and edge-case-hunter independently. The frozen spec text explicitly says "preserved verbatim if present and non-empty" — adding validation now would mean renegotiating the approved intent, not a mechanical patch. Framework header encoding already blocks the sharpest edge (CR/LF injection).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-correlation-id-structured-logging.md`
  summary: The correlation ID never appears in the ProblemDetails response body (only the header), and diverges from the `traceId` ASP.NET Core's `AddProblemDetails()` already stamps into that body from `Activity`/`HttpContext.TraceIdentifier` — two different "trace" values on the same error response.
  evidence: Blind-hunter and verification-gap both touched this. Fixing it means either customizing `AddProblemDetails()` to inject the ambient correlation ID (requires stashing it somewhere reachable from that callback, e.g. `HttpContext.Items`) or aligning with the existing `Activity`-based trace id instead of a hand-rolled one — a real design choice, not a trivial patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-correlation-id-structured-logging.md`
  summary: No `ICorrelationIdAccessor`-style abstraction exists for `Application`/`Domain` code to read the current correlation ID — only the `ILogger` scope carries it, reachable today only from Api/Infrastructure.
  evidence: Blind-hunter flagged the gap. No current story needs Application-layer access to the correlation ID (Story 1.5's postmortem uses saved log excerpts, not a live read), so building the abstraction now would be speculative.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-correlation-id-structured-logging.md`
  summary: Console logging emits the correlation ID as unstructured scope text (`=> CorrelationId:...`) rather than a structured/JSON field, making programmatic log querying by correlation ID harder in any real aggregation pipeline (Seq/ELK/App Insights).
  evidence: Blind-hunter flagged the format limitation. No log aggregation pipeline exists yet for this local-dev-only project; revisit if/when one is added.

## Deferred from: code review of spec-1-5-deliberate-di-lifetime-bug-reproduce-observe-fix (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-deliberate-di-lifetime-bug-reproduce-observe-fix.md`
  summary: No automated regression test (or DI-container lifetime assertion) protects against this captive-dependency bug reappearing — `IProductRepository` could regress back to Singleton with zero automated signal.
  evidence: Flagged independently by blind-hunter and verification-gap. No test project exists anywhere in the solution and no CI workflow runs `dotnet test`. Adding one is out of scope for a DI-registration-only bugfix story; Epic 1's own context doc assigns automated xUnit tests to Story 1.6 (Unit Tests for ProductService), not this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-deliberate-di-lifetime-bug-reproduce-observe-fix.md`
  summary: Real SQL Server credential (`sa`/`***ROTATED-DEV-PASSWORD-REMOVED***`) appears in the committed log excerpt's repro command.
  evidence: Blind-hunter flagged the committed secret. Verified pre-existing — the same credential is already committed in `docker-compose.yml` and `appsettings.Development.json` since Story 1.1; this story only repeats it, doesn't introduce it.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-deliberate-di-lifetime-bug-reproduce-observe-fix.md`
  summary: The saved log excerpt lacks "Impact"/"Prevention" sections that would strengthen it as FR9 postmortem input (blast radius, concrete guardrails going forward).
  evidence: Blind-hunter flagged the gap. Not required by this story's I/O matrix; better addressed as input when Epic 5's blameless-postmortem story is actually built.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `Program.cs`'s connection-string resolution (`GetConnectionString("DefaultConnection") ?? throw ...`) guards against a missing key but not an empty/whitespace value.
  evidence: Edge-case-hunter flagged the gap during Story 1.5's review, but the code is untouched by Story 1.5's diff and dates to Story 1.1's scaffold.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: `Api.csproj` references `Microsoft.OpenApi` 2.0.0, which carries a known high-severity NuGet advisory (GHSA-v5pm-xwqc-g5wc), surfaced as a `dotnet build` warning.
  evidence: Discovered while verifying Story 1.5's build during code review. Dependency pinned since Story 1.1's scaffold; upgrading is a separate, low-risk task not part of this bugfix.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-unit-tests-for-productservice.md`
  summary: No CI workflow exists to run `dotnet build`/`dotnet test` automatically on changes — the new `Application.Tests` suite only runs when someone remembers to invoke it locally.
  evidence: Blind-hunter flagged the gap during Story 1.6's review. Pre-existing across the whole solution (no `.github/workflows` or equivalent exists for any project), not introduced by this story; adding CI is a separate, project-wide task.

## Deferred from: code review of spec-2-1-user-registration (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `UserService.RegisterAsync` has the same check-then-act race as Story 1.2/1.3's Category/Product services — two concurrent registrations for the same email can both pass the `GetByEmailAsync` existence check, and the losing `SaveChangesAsync` throws an unhandled `DbUpdateException` (500) instead of a clean 409. The DB-level unique index still prevents a duplicate from ever physically landing.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. The spec's frozen "Never" boundary explicitly forbids closing this race by catching `DbUpdateException` in `UserService`, since that requires Application to depend on EF Core (AD-2) — same accepted, already-deferred pattern as Category/Product.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `UserRegistrationRequestDto.Password` has only `[Required]` — no minimum length or complexity policy, so a one-character password is accepted.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. The spec's frozen "Never" boundary explicitly excluded inventing a password-strength policy since it isn't in this story's acceptance criteria; a real but knowingly-deferred gap.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `UserService.RegisterAsync` skips password hashing entirely on the duplicate-email path (returns early before `HashPassword` is called), creating a timing difference between the "email taken" and "email available" outcomes — a minor email-enumeration side channel on top of the already-explicit "Email already registered" 409 message the approved spec deliberately returns.
  evidence: Blind-hunter flagged the timing side channel. Low incremental risk since the 409 body already discloses registration status by design; not required by this story's acceptance criteria to close.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `POST /api/auth/register` has no rate limiting or per-IP/per-email throttling, leaving it open to automated mass account creation or brute-force probing.
  evidence: Blind-hunter flagged the gap. Real operational hardening concern; no rate-limiting middleware exists anywhere in the solution yet, so adding it here would be a project-wide decision, not a per-endpoint patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: No email verification flow exists — accounts are created and immediately usable with no `IsEmailConfirmed`/confirmation-token column or send/verify mechanism.
  evidence: Blind-hunter flagged the gap. Real feature, but a distinct, unscoped capability with no FR/AC covering it for this story; would be its own story if prioritized.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: Neither `UserService` nor `AuthController` emit a business-event log line (successful registration, duplicate-email attempt) — `CorrelationIdMiddleware` (Story 1.4) still wraps every request, but there's no registration-specific signal for security monitoring.
  evidence: Blind-hunter flagged the gap. Real observability gap for a public-facing account-creation endpoint; non-blocking for a local-dev-only project with no log aggregation pipeline yet (same reasoning already logged against Story 1.4).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: The `User` entity/migration has no `CreatedAtUtc` timestamp and no `IsActive`/soft-delete flag — baseline audit columns typically expected on a user table from day one.
  evidence: Blind-hunter flagged the gap. Real schema-completeness concern; not required by this story's I/O matrix, cheap to add in a follow-up migration.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: Email case-insensitive matching relies entirely on app-side `Trim().ToLowerInvariant()` normalization; the DB collation used for the unique index and `WHERE Email ==` comparisons is never pinned explicitly, so case-(in)sensitivity technically depends on SQL Server's default collation agreeing with that assumption.
  evidence: Blind-hunter flagged the portability gap. Currently works because SQL Server's default collation is case-insensitive, but nothing in the migration guarantees that across environments; low risk for a single-developer local setup.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `AuthController.Register` returns `StatusCode(201, user)` with no `Location` header, and there's no `GET` endpoint for a single user to point one at, so the created resource isn't addressable via the API.
  evidence: Blind-hunter flagged the REST-convention gap. Not required by this story's acceptance criteria (only the 201 status is specified); adding a GET-by-id endpoint now would be scope creep beyond the approved spec, mirroring the already-deferred "no GET /products?categoryId=" gap from Story 1.3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `User.PasswordHash` (and all `User` properties) are publicly settable — any code holding a `User` reference can overwrite the hash directly, bypassing `UserService`/`IPasswordHasher`.
  evidence: Blind-hunter flagged the gap. Consistent with the already-accepted anemic-entity pattern used by `Category`/`Product` since Story 1.1 (no base class, public setters); riskier here since the field is security-sensitive, but changing the entity pattern unilaterally for one entity is out of this story's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: `RegisterAsync`'s `(UserRegistrationResult, UserDto?)` tuple return compiles even if a caller reads `.User` without checking `.Result` first, and doesn't extend cleanly if more failure reasons are added later.
  evidence: Blind-hunter flagged the design smell. Deliberately mirrors the existing `ProductWriteResult`/`CategoryDeleteResult` convention the spec's Code Map cited as the pattern to follow; already flagged as an accepted, non-blocking maintainability concern for `ProductWriteResult` itself in Story 1.3's deferred-work entry.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-user-registration.md`
  summary: Registration captures no password-confirmation field and no consent/Terms-of-Service acceptance — commonly expected fields for a registration flow.
  evidence: Blind-hunter flagged the gap. Neither field appears anywhere in the PRD, epics, or this story's acceptance criteria; a real but unscoped addition.

## Deferred from: code review of spec-2-2-user-login-jwt-via-httponly-cookie (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: No logout endpoint exists — nothing clears the `access_token` cookie, so a client has no way to explicitly end a session short of the token's own expiry.
  evidence: Blind-hunter flagged the gap. Not in this story's AC (issuance only); a natural follow-up once a real frontend consumes the cookie in Epic 3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `UserService.LoginAsync` has a timing side-channel: the unknown-email branch returns immediately, while the wrong-password branch first runs `IPasswordHasher<User>.VerifyHashedPassword` — the extra work on one path but not the other is a measurable timing difference an attacker could use for email enumeration, undercutting the identical-401 design goal.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. Same class of gap already deferred for Story 2.1's registration flow (hash-only-on-one-path timing signal); closing it (e.g. a dummy hash on the unknown-email path) is a cheap follow-up, not blocking for this story's AC.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `POST /api/auth/login` has no rate limiting, throttling, or account lockout, leaving it open to unthrottled credential-stuffing/brute-force attempts.
  evidence: Blind-hunter flagged the gap. Mirrors Story 2.1's already-deferred rate-limiting finding for `/api/auth/register`; no rate-limiting middleware exists anywhere in the solution, so adding it is a project-wide decision spanning both auth endpoints.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `LoginAsync` never checks `PasswordVerificationResult.SuccessRehashNeeded` — only `Failed` short-circuits — so if the hasher ever flags a stored hash for upgrade (e.g. a work-factor bump), the opportunity to transparently rehash and persist the stronger hash on next login is silently dropped.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. Real, low-likelihood-until-a-hasher-parameter-change gap; cheap to add later, no AC currently requires it.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: No CORS policy is configured anywhere in `Program.cs`. Combined with `SameSite=Strict`, a frontend served from a different origin than this API would need explicit `AllowCredentials()`+origin configuration for the cookie to ever reach the browser or be sent back.
  evidence: Blind-hunter flagged the gap. Explicitly out of this story's scope — Story 2.3 is literally titled "Protect Mutation Endpoints & Scope CORS" per `epics.md`; CORS configuration is that story's named responsibility, not 2.2's.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: Issued JWTs carry no `jti` claim and there is no revocation/blocklist mechanism — once minted, a token stays valid for its full lifetime with no way to invalidate a single compromised token early (e.g. after a password change, once one exists).
  evidence: Blind-hunter flagged the gap. Real, but a token-revocation strategy is a design decision of its own with no current AC requiring it; safe to revisit if/when a logout or password-change flow lands.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `Jwt:SigningKey` sits in plaintext in `appsettings.Development.json` with no `dotnet user-secrets`/external secrets manager, and no documented plan for how a production signing key would be supplied, protected, or rotated.
  evidence: Blind-hunter flagged the gap. Consistent with the already-accepted pattern for the SQL Server `sa` credential (committed the same way since Story 1.1); a production-secrets strategy is a project-wide, single-developer-local-dev-appropriate deferral, not specific to this story.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: No audit/security logging exists around login attempts (success or failure) — no way to detect or investigate brute-force activity or anomalous login patterns after the fact.
  evidence: Blind-hunter flagged the gap. Mirrors Story 2.1's already-deferred "no business-event logging" finding for registration; same reasoning (no log aggregation pipeline exists yet for this local-dev-only project).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `SameSite=Strict` is doing real CSRF-mitigation work for the login cookie today, but nothing documents this as a deliberate interim decision pending Story 2.3's dedicated CSRF/anti-forgery token mechanism (AD-5).
  evidence: Blind-hunter flagged the documentation gap. Distinct from Story 2.3's actual CSRF-token implementation (already out of scope per this story's Never boundary) — this is specifically about stating the current baseline protection explicitly rather than leaving it implicit.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: Neither `login` nor `me` declare `[ProducesResponseType]` metadata, so the generated OpenAPI document doesn't accurately describe their 200/401/400/409 response shapes.
  evidence: Blind-hunter flagged the gap. Mirrors the already-deferred, project-wide `[ProducesResponseType]` gap logged against Story 1.2's `CategoriesController`.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: An extremely large `Jwt:ExpiryMinutes` config value could overflow `DateTime.UtcNow.AddMinutes(...)`, throwing an unhandled `ArgumentOutOfRangeException` on every login attempt.
  evidence: Edge-case-hunter flagged the gap. Low-likelihood misconfiguration (would require a deliberately absurd config value); cheap to clamp later, not worth blocking on now.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `AuthController.Me()` returns identity built purely from JWT claims with no DB lookup, so a user deleted or changed after token issuance still appears valid to `/me` until the token's own expiry.
  evidence: Edge-case-hunter flagged the gap. Inherent to the claims-only design chosen for this minimal verification endpoint (see spec's Design Notes); revisiting would mean either a DB round-trip on every authenticated request or a revocation mechanism (already deferred above), neither required by this story's AC.

## Post-implementation ops on spec-2-3-protect-mutation-endpoints-scope-cors (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-protect-mutation-endpoints-scope-cors.md`
  summary: Manual end-to-end verification (register → login → `/me` → mutation without CSRF → mutation with correct `X-CSRF-TOKEN` → unauthenticated mutation) was independently re-run against a locally launched Api process after the dev DB password/JWT signing key rotation below, confirming the 401/400/201/401 sequence still holds. All test data (user row, category row) was deleted from the DB afterward and the Api process was stopped; DB confirmed empty of residue.
  evidence: Re-validation requested by the user post-rotation, not a new finding — confirms the rotated credentials didn't regress the auth/CSRF/CORS behavior this spec implemented.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-solution-scaffold-domain-model.md`
  summary: Git history was rewritten with `git-filter-repo` to scrub the original (pre-rotation) SQL Server `sa` password and JWT signing key from every commit and blob, then force-pushed to `origin/main`. All three commit SHAs that existed at that point changed (`6afb0d9`→`f1bc57f`, `147abd4`→`0242d85`, `90d16ae`→`48c9b34`); a local backup bundle was taken before the rewrite and deleted once the push was verified.
  evidence: User-requested cleanup after rotating the credential this ledger already flagged as committed-by-design in the Story 1.5 entry above. The rotated values remain intentionally committed in `docker-compose.yml` per spec-1-1's Design Notes — only the stale pre-rotation values were removed from history. `appsettings.Development.json` itself was separately untracked going forward (added to `.gitignore`) in the same effort.

## Deferred from: code review of spec-2-3-protect-mutation-endpoints-scope-cors (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-protect-mutation-endpoints-scope-cors.md`
  summary: `AuthController.Login`'s `access_token` cookie is set with no explicit `Expires`/`MaxAge`, so its lifetime (session-scoped, cleared on browser close) is not tied to `Jwt:ExpiryMinutes` — a long-lived browser session can hold a cookie well past the JWT's own signature-checked expiry, relying entirely on server-side `ValidateLifetime` to reject it rather than the cookie itself expiring.
  evidence: Blind-hunter flagged the gap. Pre-existing since Story 2.2's cookie-issuance code, untouched by this story's diff (only `[IgnoreAntiforgeryToken]` was added to `Login`); surfaced incidentally by this review, not caused by 2.3.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-protect-mutation-endpoints-scope-cors.md`
  summary: `CategoryService.DeleteAsync`'s `HasProducts` → 409 branch (`CategoriesController.Delete`) has zero test coverage anywhere in the repo — no `CategoryServiceTests.cs` exists and no test references `CategoryDeleteResult`/`HasProducts`; the only test reaching `DELETE /api/categories/{id}` sends no cookie and is blocked by the 401 challenge before this switch ever runs.
  evidence: Verification-gap flagged the gap with a repo-wide grep confirming zero matches. Pre-existing since Story 1.2's delete logic, untouched by this story's diff (only `[Authorize]` was added around the existing switch); surfaced incidentally by this review, not caused by 2.3. Demonstrated: inverting or dropping the `HasProductsAsync` check would leave every existing test green.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-3-protect-mutation-endpoints-scope-cors.md`
  summary: `ProductsController`'s `ProductWriteResult`→HTTP-status mapping (`CategoryNotFound`→400 on Create/Update, `NotFound`→404 on Update) has no controller/HTTP-level test — `ProductServiceTests.cs` only asserts what `ProductService` returns, never what the controller does with it, and no integration test hits `/api/products` with an invalid/missing category or product id.
  evidence: Verification-gap flagged the gap with a repo-wide grep confirming zero matches. Pre-existing since Story 1.3's mapping logic, untouched by this story's diff (only `[Authorize]` was added around the existing switch); surfaced incidentally by this review, not caused by 2.3. Demonstrated: swapping the status-code arms would leave every existing test green.

## Deferred from: code review of spec-3-1-api-client-foundation-resilience-layer (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-api-client-foundation-resilience-layer.md`
  summary: `apiFetch` sets no request timeout/`AbortController` — a connection the server accepts but never responds to hangs indefinitely; retry logic never kicks in because `fetch` never rejects or resolves.
  evidence: Blind-hunter flagged the gap. Real robustness gap, but outside the frozen I/O matrix's scope (network failure/5xx/4xx/2xx only, no "hung connection" row); no AC requires it. Worth adding once a real caller (3.2+) surfaces the need.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-api-client-foundation-resilience-layer.md`
  summary: `apiFetch` has no shared JSON-body/`Content-Type` convenience — every future caller (Stories 3.2–3.5's Create/Update calls) must remember to set `Content-Type: application/json` manually per call, with nothing enforcing it.
  evidence: Blind-hunter flagged the gap. Real ergonomic gap in the shared foundation, but designing the helper's exact shape is a small API decision this story's frozen Never boundary didn't scope in; better resolved when Story 3.3 (Create Product) becomes the first real caller.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-api-client-foundation-resilience-layer.md`
  summary: Nothing documents that the client (port 5173) talking cross-origin HTTPS to the API (port 7197) requires the ASP.NET Core dev certificate to be trusted (`dotnet dev-certs trust`) — a newcomer running both for the first time will likely hit unexplained fetch failures with no guidance.
  evidence: Blind-hunter flagged the onboarding gap. Real DX issue, cheap to fix with a README note, but no story's Tasks list currently owns writing client/API setup docs (the same gap already logged generically against Story 1.1).

## Deferred from: code review of spec-3-2-product-list-view (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-product-list-view.md`
  summary: `ProductList`'s component-level fix (ignoring stale/unmounted-state updates) stops the *state* from updating after unmount or a superseded retry, but the underlying HTTP request itself is never cancelled at the network level — `apiFetch` accepts no `AbortSignal` wiring from callers, and its own retry loop would treat a genuine `AbortError` as a network failure and retry it anyway.
  evidence: Surfaced while patching the unmount/race-condition findings from blind-hunter and edge-case-hunter. Real gap, but fixing it properly means extending Story 3.1's `apiFetch` contract (cancellation-aware retries) — a design decision for that shared foundation, not a one-component patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-product-list-view.md`
  summary: `ProductList`'s loading/error/success containers use plain `<div>`s with no `<main>` landmark, the `<table>` has no `<caption>`, and the loading container has no explicit `aria-busy` — real but minor accessibility gaps.
  evidence: Blind-hunter flagged the gaps. No AC requires WCAG-level landmark/caption coverage for this MVP list view; cheap to add later alongside a broader a11y pass.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-product-list-view.md`
  summary: No React error boundary wraps `ProductList` in `App.tsx` — an unexpected render-time exception anywhere in the tree crashes the whole app with no fallback UI, instead of a contained error message.
  evidence: Blind-hunter flagged the gap. Real resilience gap, but adding an error boundary is an app-wide architectural decision (where does it live, what does its fallback look like) beyond this single component's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-product-list-view.md`
  summary: The product table has no pagination, sorting, filtering/search, or locale-aware currency formatting (`Intl.NumberFormat`) — a hardcoded `$${price.toFixed(2)}` and an unbounded row list.
  evidence: Blind-hunter flagged the gaps. Explicitly out of this story's AC ("fetched and displayed"); mirrors the already-deferred backend gaps (no `OrderBy`, no category filter endpoint) — worth revisiting together if the catalog ever needs to scale past a demo-sized dataset.

## Split from: Story 3.3 intent (2026-08-19)

- source_spec: none
  summary: Story 3.3 (Create Product) itself — the create form, its validation/submit flow, and the product-list refresh on success.
  evidence: User asked to fold "add a minimal login form" into the Story 3.3 intent so it's demoable end-to-end, but a login form and Create Product are two independently shippable deliverables (SCOPE STANDARD multi-goal check). User chose to split: the login form ships first as its own spec (`spec-epic-3-prereq-login-form.md`), Create Product follows as its own spec afterward.

## Deferred from: code review of spec-epic-3-prereq-login-form (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-3-prereq-login-form.md`
  summary: Nothing re-checks the session after the initial mount-time `/api/auth/me` call — if the `access_token` cookie expires while the user is actively using the app, `AuthContext`'s `status` stays `'authenticated'` and the UI keeps rendering `ProductList` until a manual page reload, rather than detecting the 401 on a later mutation and re-prompting for login.
  evidence: Blind-hunter flagged the gap. Outside the frozen I/O matrix's scope (mount-check and login flow only, no "session expires mid-use" row); worth revisiting once Stories 3.3–3.5's mutation calls exist to actually observe a stale-session 401.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-3-prereq-login-form.md`
  summary: `LoginForm`'s error state has no focus management (focus isn't moved to the alert or back to a field) and its inputs have no `aria-invalid`/`aria-describedby` linking them to the error message — real accessibility gaps.
  evidence: Blind-hunter flagged the gaps. Mirrors the same class of gap already deferred against Story 3.2's `ProductList`; no AC requires WCAG-level coverage for this MVP form.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-3-prereq-login-form.md`
  summary: Once authenticated, no UI anywhere displays who's logged in (`UserDto.email` is fetched into context but never rendered) — no "signed in as…" indicator or way to tell which account is active.
  evidence: Blind-hunter flagged the gap. Real UX gap, but no AC requires it for this minimal prerequisite; natural fit for whichever story first adds persistent app chrome (header/nav).

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-3-prereq-login-form.md`
  summary: `AuthContext.tsx`'s `describeAuthError` is a line-for-line duplicate of `ProductList.tsx`'s `describeError` (same network-error message, same title/detail join logic, same status fallback) — the two can silently drift if one is fixed without the other.
  evidence: Verification-gap flagged the duplication. Real DRY concern, but extracting a shared helper means touching Story 3.2's already-reviewed `ProductList.tsx` as a side effect and deciding where the shared module lives — a small design decision, not a same-file patch.

- source_spec: `_bmad-output/implementation-artifacts/spec-epic-3-prereq-login-form.md`
  summary: `LoginForm`'s error message only clears when the next submit fires (`setError(null)` at the top of `handleSubmit`) — it stays on screen, unchanged, while the user edits the email/password fields to retry.
  evidence: Blind-hunter flagged the gap. Minor UX polish, not required by any AC; cheap to add (clear on field change) if it proves to matter in practice.

## Deferred from: code review of spec-3-3-create-product (2026-08-19)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-create-product.md`
  summary: `CreateProductForm`'s error message only clears on the next submit, not as the user edits fields afterward — same class of gap already deferred against `LoginForm`.
  evidence: Blind-hunter flagged the gap. Minor UX polish, not required by any AC.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-create-product.md`
  summary: No focus management on submit failure, no `aria-invalid`/`aria-describedby`/`aria-busy` linking inputs to the error state, and no `:focus-visible`/invalid-state CSS — real accessibility gaps.
  evidence: Blind-hunter flagged the gaps. Mirrors the same class of gap already deferred against `ProductList` and `LoginForm`; no AC requires WCAG-level coverage for this MVP form.

## Deferred from: code review of spec-3-4-edit-product (2026-08-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-edit-product.md`
  summary: `ProductForm`'s single generic validation error isn't linked to specific fields via `aria-invalid`/`aria-describedby`, and switching between create/edit modes moves no focus to the heading or first field — same class of a11y gap already deferred against `LoginForm`/`ProductList`/`CreateProductForm`.
  evidence: Blind-hunter flagged the gaps. No AC requires WCAG-level coverage for this MVP form.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-4-edit-product.md`
  summary: The blank-field/first-category reset logic is duplicated between the `targetKey` resync effect and `handleSubmit`'s create-success branch in `ProductForm.tsx` — small DRY concern, risk of drift if one is edited without the other.
  evidence: Blind-hunter flagged the duplication. Low risk given both are ~3 lines; not worth a same-file patch on its own.

## Deferred from: code review of spec-3-5-delete-product (2026-08-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-delete-product.md`
  summary: The Delete button has no accessible name distinguishing which product it acts on (e.g. `aria-label="Delete {name}"`), and has no distinct destructive/danger visual styling separating it from Edit — same class of a11y/styling gap already deferred against `LoginForm`/`ProductList`/`ProductForm`.
  evidence: Blind-hunter flagged the gaps. No AC requires WCAG-level coverage or a specific visual language for this MVP list.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-delete-product.md`
  summary: Every delete failure (404 because the product was already removed elsewhere, 409, 500, network) is funneled through the same generic error message — no status-specific handling (e.g. a 404 could silently trigger a refetch instead of showing an error for a row that no longer exists).
  evidence: Blind-hunter flagged the gap. Real but a design decision beyond this story's scope; matches the same "one generic message" precedent already accepted for `ProductForm`/`LoginForm`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-delete-product.md`
  summary: If a DELETE succeeds but the follow-up `fetchProducts()` refresh itself fails, the whole view flips to the generic fetch-error screen with no indication the delete actually succeeded — the user can't tell whether to retry the delete or just the refresh.
  evidence: Blind-hunter flagged the ambiguity. Real edge case, but resolving it cleanly needs a three-way state model (delete-succeeded-but-refresh-failed) beyond a simple patch; no AC requires it.

## Deferred from: blind-hunter review of Story 4.1 (Architecture Decision Records, 2026-08-20)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-architecture-decision-records.md`
  summary: The Story 2.3 CSRF/anti-forgery token mechanism — introduced specifically as a second control to close the CSRF gap `docs/adr/003-httponly-cookie-token-storage.md`'s cookie decision opened — has no ADR of its own, despite being a substantial, independently-motivated security decision (which token strategy, which endpoints it covers, why `[IgnoreAntiforgeryToken]` on `Login` specifically).
  evidence: Flagged by the blind-hunter review of the ADR set. Real documentation gap, but writing it is a new ADR (a 7th, beyond this story's approved 4-6 scope), not a fix to an existing file — better scoped as its own follow-up if a future ADR pass happens.

- source_spec: `_bmad-output/implementation-artifacts/spec-4-1-architecture-decision-records.md`
  summary: Every ADR's Consequences section buries its open, unresolved gaps (the check-then-act 500-instead-of-409 races, the two validation gaps, the missing DI regression test) inside prose rather than a discrete, scannable "Known Issues" list, making them easy to skim past as accepted tradeoffs rather than still-open defects.
  evidence: Flagged by the blind-hunter review of the ADR set. Real readability concern across all 6 files; restructuring every Consequences section is a formatting decision affecting the whole set, not a single-file patch — worth doing together if the ADR set is revised again.

## Deferred from: Epic 4 retrospective cross-document review (2026-08-22)

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-deliberate-di-lifetime-bug-reproduce-observe-fix.md`
  summary: `story-1-5-di-bug-log-excerpt.md` cites the DI-lifetime fix at "`src/Api/Program.cs` line 42" — the actual `AddScoped<IProductRepository, ProductRepository>()` registration is now at line 85, since later stories added code above it in `Program.cs`. No document that links this log excerpt (ADR-006, the code review checklist, the mentoring note) flags that the line number has drifted.
  evidence: Flagged by the edge-case-hunter lens during Epic 4's retrospective, re-verified against the current `src/Api/Program.cs`. Pre-existing since Story 1.5 (Epic 1), not introduced by Epic 4 — the log excerpt is a historical record that shouldn't be edited to "correct" a line number that was accurate at the time it was written; a caveat note at the citing end is the honest fix, not attempted here since it touches three separate Epic 4 documents for a low-impact drift.

## Deferred from: code review of spec-2-2-user-login-jwt-via-httponly-cookie (2026-08-22)

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-user-login-jwt-via-httponly-cookie.md`
  summary: `SameSite=Strict` on the `access_token` cookie may not survive a genuinely cross-domain (not just cross-port) frontend/API deployment — `SameSite=Strict` cookies are never sent on requests where the top-level site differs, which is a stricter bar than just "different origin."
  evidence: Blind-hunter flagged the gap during code review. Works correctly today because the frontend and API are same-site (`localhost` at different ports, per the CORS config); no AC or deployment target currently requires a cross-domain split. Worth revisiting only if frontend and API ever land on genuinely different registrable domains in a real deployment.

## Epic 2 retrospective follow-up (2026-08-22)

- source_spec: `_bmad-output/implementation-artifacts/epic-2-retro-2026-08-22.md`
  summary: The check-then-act race/DI-lifetime-regression-test gap (previously logged six separate times with "no tracked ticket" across ADR-001, ADR-004, ADR-005, the code review checklist, the post-MVP roadmap, and this ledger) now has an owning backlog story: [`spec-backlog-domain-exception-check-then-act-race-fix.md`](spec-backlog-domain-exception-check-then-act-race-fix.md).
  evidence: Epic 4 retrospective action item `epic-4-retro-item-13`. The new file is an unscheduled backlog proposal, not a frozen dev-ready spec — it consolidates the six prior mentions into one place with a suggested (not approved) fix shape, so future sessions stop re-discovering the same gap from scratch.

## Deferred from: code review of epic-2-context (2026-08-22)

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No logout endpoint exists — `access_token` is `HttpOnly`, so client-side JS has no way to clear it; the API would need a `POST /api/auth/logout` (or similar) expiring the cookie server-side.
  evidence: Blind-hunter flagged the gap. Already an established, previously-noted gap from Story 2.2 (no logout flow); out of Epic 2's FR-4 scope (register/login/protect-mutations only).

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: JWTs are purely stateless with no revocation/blacklist mechanism — a stolen or compromised token remains valid for its full 60-minute lifetime with no way for the server to invalidate it early.
  evidence: Blind-hunter flagged the gap. Inherent to the stateless-JWT design AD-5 chose; no FR/NFR requires revocation for this project.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No refresh-token flow — once the access token expires the user must fully re-authenticate, with no silent-renewal path.
  evidence: Blind-hunter flagged the gap. Already documented as an accepted consequence in [ADR-003](../../docs/adr/003-httponly-cookie-token-storage.md)'s Consequences section.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: `UserService.LoginAsync` only branches on `PasswordVerificationResult.Failed`, never `SuccessRehashNeeded` — a password verified against outdated hasher parameters is silently accepted without ever being re-hashed to current standards.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. Real but zero live trigger today: `PasswordHasherOptions` are never overridden from their defaults anywhere in this app, so no stored hash can currently differ from what the current hasher would produce. Worth adding if/when hasher options are ever tuned.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: Nothing rate-limits or locks out repeated failed attempts on `/api/auth/login` or `/api/auth/register` — no throttling to blunt credential-stuffing or brute-force attacks.
  evidence: Blind-hunter flagged the gap. Real, but no FR/NFR currently requires it for this single-developer local project; same class as the already-accepted concurrency-token gap.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No `JwtBearerEvents.OnForbidden` handler — if role/policy-based authorization is ever added, 403 responses would fall back to the framework default instead of the consistent ProblemDetails shape `OnChallenge` already provides for 401s.
  evidence: Flagged independently by blind-hunter and edge-case-hunter. Currently unreachable: `AddAuthorization()` configures zero policies/roles anywhere in this app, so no code path can produce a 403 today.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: `AuthController.Register` returns `StatusCode(201, user)` with no `Location` header, unlike `CategoriesController`/`ProductsController`'s `Create` actions, which use `CreatedAtAction`.
  evidence: Blind-hunter flagged the inconsistency. Not a spec violation — Story 2.1's frozen AC only requires "a 201 is returned" with body `{ id, email }`, no Location requirement. A real fix would need a new `GET /api/auth/{id}` user-lookup endpoint to point at, which is its own design/security decision (exposing user lookup by id), not a one-line patch.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No password-reset/forgot-password flow and no email-verification step after registration.
  evidence: Blind-hunter flagged the gap. Explicitly out of scope — spec-2-1's frozen Never boundary scopes this story to registration only, no password-strength/recovery policy.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: The pipeline calls `UseHttpsRedirection()` but never `UseHsts()` for non-development environments, and no security-headers middleware (e.g. `X-Content-Type-Options`) exists.
  evidence: Blind-hunter flagged the gap. Real hardening gap for a future real deployment; no current deployment target requires it (this project runs local-dev only today).

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No authentication-event audit logging (failed logins, registrations, lockouts) beyond the generic `CorrelationIdMiddleware`.
  evidence: Blind-hunter flagged the gap. Real, but no FR/NFR requires it; this class of observability tooling is Epic 5 (Engineering Manager Artifacts)/post-MVP-roadmap scope, not Epic 2.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: No controller actions carry `[ProducesResponseType]` attributes for their non-200 outcomes (401/409/400/404), so the generated OpenAPI spec won't document those response shapes even though `AddProblemDetails()` standardizes them at runtime.
  evidence: Blind-hunter flagged the gap. Cosmetic API-documentation completeness gap; no FR/NFR requires it.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: `UserService.LoginAsync`'s `VerifyHashedPassword` call has no guard against a malformed/corrupted `PasswordHash` value — a `FormatException` would bubble up as an unhandled 500 instead of a clean 401.
  evidence: Edge-case-hunter flagged the gap. Real but requires an externally-corrupted DB row; `PasswordHash` is only ever written by this app's own `HashPassword` call, with no exposed endpoint that could write a malformed value through the app's own code paths.

- source_spec: `_bmad-output/implementation-artifacts/epic-2-context.md`
  summary: `jwtOptions.ExpiryMinutes` has no upper bound (only `<= 0` is rejected) — an absurdly large config value could overflow `DateTime.UtcNow.AddMinutes(...)`.
  evidence: Edge-case-hunter flagged the gap independently; already logged verbatim earlier in this ledger (Story 2.2 section) — duplicate confirmation, not a new finding. Low-likelihood misconfiguration, cheap to clamp later.
