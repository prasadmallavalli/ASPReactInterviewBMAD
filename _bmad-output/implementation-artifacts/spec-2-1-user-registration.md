---
title: 'User Registration'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The system has no way for a user to create an account — every future auth flow (login, protected mutations) depends on a `User` record existing with a safely-stored credential.

**Approach:** Add a `User` entity + repository + `UserService.RegisterAsync`, exposed via `POST /api/auth/register`, hashing the password with the framework-provided `PasswordHasher<User>` and rejecting duplicate emails, following the exact layering already established by Category/Product in Epic 1.

## Boundaries & Constraints

**Always:**
- Password is hashed via `PasswordHasher<User>` (`Microsoft.AspNetCore.Identity`, framework-provided, stateless — register `AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>()` per AD-4) before it ever reaches the repository; the raw password is never persisted, logged, or returned.
- Email is normalized (`Trim().ToLowerInvariant()`) before uniqueness check and storage, so `Foo@x.com` and `foo@x.com` collide correctly.
- `Email` has a DB-level unique index (Fluent API in `OnModelCreating`, same inline style as existing entities) so a duplicate can never physically land even if the check-then-act race below is hit.
- Success returns 201 with `{ id, email }` only — password/hash never appear in any response DTO.
- Controller depends only on `IUserService` (AD-1); `UserService` depends only on `IUnitOfWork` (AD-2) — no EF Core types in Application.
- Validation is Data Annotations only on the request DTO (AD-8): `[Required, EmailAddress]` on Email, `[Required]` on Password — malformed payloads 400 automatically via `[ApiController]`.

**Ask First:** none — this follows established Epic 1 conventions with no new architectural decisions.

**Never:**
- Do not attempt to close the check-then-act duplicate-email race (email-exists check, then insert) by catching `DbUpdateException` in `UserService` — that requires Application to depend on EF Core, forbidden by AD-2. Same accepted, already-deferred pattern as Category/Product in Epic 1; the unique index still guarantees no bad data lands, worst case is a 500 instead of a clean 409 on the race window.
- Do not build login, JWT issuance, or cookie handling here — that is Story 2.2.
- Do not invent a password-strength policy (length/complexity rules) — not in this story's acceptance criteria; only presence is validated.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | Valid, unused email + non-empty password | 201, body `{ id, email }`, `PasswordHash` stored, never plaintext | N/A |
| Duplicate email | Email already registered (case-insensitive match) | 409 `ProblemDetails`, no row written | `Problem(title: "Email already registered", statusCode: 409)` |
| Missing password | Email present, `password` omitted/empty | 400 `ProblemDetails` (model-state) | Automatic via `[ApiController]` + `[Required]` |
| Malformed email | `email: "not-an-email"` | 400 `ProblemDetails` (model-state) | Automatic via `[ApiController]` + `[EmailAddress]` |
| Case-varied duplicate | `Foo@X.com` registered, then `foo@x.com` submitted | 409, treated as the same email | Normalization before uniqueness check |

</frozen-after-approval>

## Code Map

- `src/Domain/Entities/Product.cs`, `Category.cs` -- POCO pattern to mirror for `User.cs` (no base class, `required` props)
- `src/Domain/Interfaces/IUnitOfWork.cs:10-12` -- add `IUserRepository Users { get; }` alongside existing properties
- `src/Domain/Interfaces/ICategoryRepository.cs` -- interface shape to mirror for `IUserRepository` (`GetByEmailAsync`, `AddAsync`)
- `src/Infrastructure/Data/AppDbContext.cs:17-19` (DbSet exposure), `:21-38` (`OnModelCreating`) -- add `User` DbSet + Fluent config (unique index on `Email`, `HasMaxLength` on `Email`/`PasswordHash`)
- `src/Infrastructure/Repositories/CategoryRepository.cs` -- ctor-injects `AppDbContext`, no `SaveChanges` inside; pattern for `UserRepository.cs`
- `src/Infrastructure/UnitOfWork.cs` -- wire the new `Users` repository property
- `src/Infrastructure/Migrations/` -- new migration via `dotnet ef migrations add AddUserEntity -p src/Infrastructure -s src/Api`
- `src/Application/Services/ProductService.cs:13-20` -- ctor pattern (`IUnitOfWork` only) for `UserService`
- `src/Application/Services/IProductService.cs:42` (`ProductWriteResult` enum) -- pattern for a new `UserRegistrationResult { Success, EmailAlreadyExists }`
- `src/Application/Mappers/` -- existing `{Entity}Mapper.cs` extension-method pattern (AD-9) for `UserMapper.ToDto()`
- `src/Api/Controllers/ProductsController.cs:15-16` (`[ApiController]`/`[Route]`), `:55-58` (`Problem()` usage) -- pattern for `AuthController`
- `src/Api/Program.cs:44,53-56` -- DI registration block; add `IUserRepository`/`IUserService`/`IPasswordHasher<User>` here
- `src/Api/Program.cs:71,78` -- `CorrelationIdMiddleware`/`UseExceptionHandler()` ordering, already covers any new controller, no changes needed
- `tests/Application.Tests/Services/ProductServiceTests.cs` -- Moq+xUnit pattern (mocked `IUnitOfWork`, no real `AppDbContext`) for `UserServiceTests.cs`

## Tasks & Acceptance

**Execution:**
- [x] `src/Domain/Entities/User.cs` -- add `Id`, `Email`, `PasswordHash` -- new entity
- [x] `src/Domain/Interfaces/IUserRepository.cs` -- add `GetByEmailAsync(string email)`, `AddAsync(User user)` -- repository contract
- [x] `src/Domain/Interfaces/IUnitOfWork.cs` -- add `IUserRepository Users { get; }` -- expose new repo
- [x] `src/Infrastructure/Repositories/UserRepository.cs` -- implement `IUserRepository` against `AppDbContext` -- data access
- [x] `src/Infrastructure/UnitOfWork.cs` -- wire `Users` property -- DI composition
- [x] `src/Infrastructure/Data/AppDbContext.cs` -- add `DbSet<User>`, unique index + max-length on `Email`, max-length on `PasswordHash` -- schema
- [x] EF migration `AddUserEntity` -- generate + apply -- persist schema change
- [x] `src/Application/DTOs/UserRegistrationRequestDto.cs` -- `Email` (`[Required, EmailAddress]`), `Password` (`[Required]`) -- request shape
- [x] `src/Application/DTOs/UserDto.cs` -- `Id`, `Email` -- response shape, no password
- [x] `src/Application/Mappers/UserMapper.cs` -- `ToDto()` -- AD-9 manual mapping
- [x] `src/Application/Services/IUserService.cs` -- `RegisterAsync(...)` returning `(UserRegistrationResult, UserDto?)`; `UserRegistrationResult` enum -- contract
- [x] `src/Application/Services/UserService.cs` -- normalize email, check existence, hash via `IPasswordHasher<User>`, persist -- business logic
- [x] `src/Application/Application.csproj` -- add `Microsoft.Extensions.Identity.Core` package reference -- for `PasswordHasher<User>` (see Spec Change Log)
- [x] `src/Api/Controllers/AuthController.cs` -- `POST api/auth/register` -- endpoint, maps result to 201/409
- [x] `src/Api/Program.cs` -- register `IUserRepository`, `IUserService` (`Scoped`), `IPasswordHasher<User>` (`Singleton`) -- DI wiring
- [x] `tests/Application.Tests/Services/UserServiceTests.cs` -- cover happy path, duplicate-email (case-varied), and empty-password data-annotation coverage note -- test the I/O matrix

**Acceptance Criteria:**
- Given a valid, unused email + password, when POSTed to `/api/auth/register`, then 201 is returned and the password is stored hashed, never in plaintext
- Given an email already registered (including a case-varied match), when POSTed, then a 409 is returned, not a 500
- Given an invalid payload (missing password, malformed email), when POSTed, then a 400 with `ProblemDetails` is returned

## Spec Change Log

- Task list said `Microsoft.AspNetCore.Identity` as the package reference to add to `Application.csproj`. That legacy NuGet package (v2.3.1, the pre-.NET-Core-3 compat package) pulls in an outdated `System.Security.Cryptography.Xml` transitive dependency flagged by NuGet as a known high-severity vulnerability (GHSA-23rf-6693-g89p and others), for XML-based key storage this project never uses. Used `Microsoft.Extensions.Identity.Core` (v10.0.11) instead — the modern, lean package that ships the same `Microsoft.AspNetCore.Identity.IPasswordHasher<TUser>`/`PasswordHasher<TUser>` types with no vulnerable transitive dependencies. No behavior change; same framework-provided, stateless hasher the Design Notes describe.

## Design Notes

`PasswordHasher<User>` (from `Microsoft.AspNetCore.Identity`) is chosen over a third-party hashing library (e.g. BCrypt.Net) because it's already part of the ASP.NET Core ecosystem the project standardizes on, needs no extra trust decision, and is framework-provided/stateless — qualifying as a DI `Singleton` under AD-4 without adding a new dependency category to the stack. It does **not** pull in the full ASP.NET Core Identity membership/store system — only the hasher class is used; `User`, `IUserRepository`, and `UserService` remain hand-rolled, matching the existing Category/Product pattern.

## Verification

**Commands:**
- `dotnet build` -- expected: solution builds with no errors
- `dotnet ef migrations add AddUserEntity -p src/Infrastructure -s src/Api` then `dotnet ef database update -p src/Infrastructure -s src/Api` -- expected: migration applies cleanly against the running `mssql` container
- `dotnet test` -- expected: new `UserServiceTests` pass alongside existing `ProductServiceTests`

**Manual checks (if no CLI):**
- `POST /api/auth/register` via curl/Postman with a valid payload, a duplicate email, and a malformed email — confirm 201/409/400 responses match the I/O matrix and the stored row has a hashed (not plaintext) `PasswordHash`

## Suggested Review Order

**Registration business logic**

- Entry point: normalizes email, checks uniqueness, hashes via `IPasswordHasher<User>`, persists — the core design decision of this story.
  [`UserService.cs:41`](../../src/Application/Services/UserService.cs#L41)

- Two-outcome result type (`Success`/`EmailAlreadyExists`) lets the controller map to distinct status codes without throwing.
  [`IUserService.cs:26`](../../src/Application/Services/IUserService.cs#L26)

**API surface**

- Thin controller: maps `EmailAlreadyExists` to 409, everything else to 201 — the only hand-written branch at this boundary.
  [`AuthController.cs:27`](../../src/Api/Controllers/AuthController.cs#L27)

- Validation-only DTO: `[Required]`/`[EmailAddress]`/`[StringLength(256)]` drive automatic 400s, no password-strength policy by design.
  [`UserRegistrationRequestDto.cs:13`](../../src/Application/DTOs/UserRegistrationRequestDto.cs#L13)

**Data access & schema**

- New entity, schema-only per the Category/Product pattern — no business logic on the type itself.
  [`User.cs:8`](../../src/Domain/Entities/User.cs#L8)

- DB-level unique index on `Email` is the last line of defense against the accepted check-then-act race.
  [`AppDbContext.cs:45`](../../src/Infrastructure/Data/AppDbContext.cs#L45)

- `AsNoTracking` lookup backs the uniqueness check; `AddAsync` only stages the insert, `UnitOfWork` commits it.
  [`UserRepository.cs:29`](../../src/Infrastructure/Repositories/UserRepository.cs#L29)

- Migration creates the `Users` table and its unique index — verify columns match `AppDbContext`'s Fluent config.
  [`20260819042721_AddUserEntity.cs:13`](../../src/Infrastructure/Migrations/20260819042721_AddUserEntity.cs#L13)

**DI wiring**

- `IPasswordHasher<User>` registered `Singleton` (framework-provided, stateless); everything else stays `Scoped` per AD-4.
  [`Program.cs:56`](../../src/Api/Program.cs#L56)

- `Microsoft.Extensions.Identity.Core` swapped in for the spec's originally-named `Microsoft.AspNetCore.Identity` — see Spec Change Log above for why.
  [`Application.csproj:15`](../../src/Application/Application.csproj#L15)

**Peripherals**

- Manual `ToDto()` mapping (AD-9) — `PasswordHash` deliberately never crosses into the response DTO.
  [`UserMapper.cs:16`](../../src/Application/Mappers/UserMapper.cs#L16)

- Covers the happy path (incl. hash verification), case-varied duplicate, and normalization-before-lookup ordering.
  [`UserServiceTests.cs:42`](../../tests/Application.Tests/Services/UserServiceTests.cs#L42)

- Added during review to close the gap `UserServiceTests` couldn't: proves the controller's 201/409 mapping is actually tested.
  [`AuthControllerTests.cs:52`](../../tests/Application.Tests/Controllers/AuthControllerTests.cs#L52)
