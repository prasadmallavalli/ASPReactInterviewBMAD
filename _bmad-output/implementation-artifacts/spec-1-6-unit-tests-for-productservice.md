---
title: 'Unit Tests for ProductService'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ProductService` (Story 1.3) has zero automated test coverage. No test project exists anywhere in the solution and no CI workflow runs `dotnet test`, so the CRUD service logic — and any future regression in it, including the DI-lifetime class of bug just observed in Story 1.5 — has no automated verification.

**Approach:** Add a new xUnit test project (`tests/Application.Tests`), reference it from the solution, and write unit tests for `ProductService`'s four CRUD methods with `IUnitOfWork` (and its `Products`/`Categories` repository properties) mocked via Moq — no real `AppDbContext` or database involved.

## Boundaries & Constraints

**Always:** Mock `IUnitOfWork` (which exposes `Categories`/`Products`) via Moq — never instantiate `AppDbContext` or hit a real database. Cover all four `ProductService` methods (`CreateAsync`, `GetByIdAsync`/`GetAllAsync`, `UpdateAsync`, `DeleteAsync`) with at least one test each, including the `CategoryNotFound`/`NotFound` branches already present in the service. `dotnet test` must exit green with zero failures.

**Ask First:** None anticipated.

**Never:** No changes to `ProductService`, `IUnitOfWork`, `IProductRepository`, `ICategoryRepository`, or any DTO/mapper — this story only adds tests against existing, unmodified production code. No integration tests against a real MSSQL instance (that's already covered manually via Stories 1.2/1.3/1.5's repro workflow) — unit tests only, per FR6.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create, valid CategoryId | Mocked `Categories.GetByIdAsync` returns a `Category` | Returns `(Success, ProductDto)`; `Products.AddAsync` + `SaveChangesAsync` invoked once | N/A |
| Create, missing CategoryId | Mocked `Categories.GetByIdAsync` returns `null` | Returns `(CategoryNotFound, null)`; `Products.AddAsync` never invoked | N/A |
| Update, missing Product id | Mocked `Products.GetByIdAsync` returns `null` | Returns `(NotFound, null)`; `Categories.GetByIdAsync`/`SaveChangesAsync` never invoked | N/A |
| Update, valid ids | Mocked `Products.GetByIdAsync` and `Categories.GetByIdAsync` both return non-null | Returns `(Success, ProductDto)` reflecting the applied changes | N/A |
| Delete, existing id | Mocked `Products.GetByIdAsync` returns a `Product` | Returns `true`; `Products.Remove` + `SaveChangesAsync` invoked once | N/A |
| Delete, missing id | Mocked `Products.GetByIdAsync` returns `null` | Returns `false`; `Products.Remove`/`SaveChangesAsync` never invoked | N/A |

</frozen-after-approval>

## Code Map

- `src/Application/Services/ProductService.cs` -- test subject; constructor takes only `IUnitOfWork` (not `IProductRepository` directly) — `_unitOfWork.Products`/`_unitOfWork.Categories` are what Moq must mock
- `src/Domain/Interfaces/IUnitOfWork.cs` -- exposes `Categories`/`Products`/`SaveChangesAsync`; mock this interface directly
- `src/Domain/Interfaces/IProductRepository.cs`, `src/Domain/Interfaces/ICategoryRepository.cs` -- mock setups target these members via `Mock<IUnitOfWork>.Setup(u => u.Products)`/`.Setup(u => u.Categories)` returning `Mock<IProductRepository>.Object`/`Mock<ICategoryRepository>.Object`
- `src/Application/Services/IProductService.cs:42` -- `ProductWriteResult` enum (`Success`/`NotFound`/`CategoryNotFound`) — assert against these values
- `src/Domain/Entities/Product.cs`, `src/Domain/Entities/Category.cs` -- `Product.Category`/`Category` are `required` — test fixtures must supply a `Category` instance when constructing a `Product`
- `src/Application/DTOs/ProductRequestDto.cs`, `src/Application/DTOs/ProductDto.cs` -- request/response shapes for Create/Update test inputs and assertions
- `src/Application/Application.csproj` -- existing project, `net10.0`/`ImplicitUsings`/`Nullable` enabled, references only `Domain` — pattern to follow for the new test project's `PropertyGroup`
- `ASPFullStackBMAD.sln` -- add the new test project here (new `tests` solution folder alongside `src`, matching its existing `Project("{2150E333...}") = "src", "src", ...` folder-node pattern)
- New: `tests/Application.Tests/Application.Tests.csproj` -- new xUnit test project referencing `Application.csproj`, with `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, and `Moq` package references (current stable versions at scaffold time)
- New: `tests/Application.Tests/Services/ProductServiceTests.cs` -- the test class covering the I/O matrix above

## Tasks & Acceptance

**Execution:**
- [x] `tests/Application.Tests/Application.Tests.csproj` -- create xUnit test project (`net10.0`, `ImplicitUsings`/`Nullable` enabled) referencing `src/Application/Application.csproj`, with `Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, `Moq` package references -- establishes the solution's first test project
- [x] `ASPFullStackBMAD.sln` -- add `tests/Application.Tests/Application.Tests.csproj` to the solution -- makes `dotnet test`/`dotnet build` at the solution level pick it up
- [x] `tests/Application.Tests/Services/ProductServiceTests.cs` -- write tests for all six I/O matrix scenarios using `Mock<IUnitOfWork>` -- verifies `ProductService`'s CRUD logic and both not-found branches without a live DB
- [x] Run `dotnet test` -- confirm the new suite is green

**Acceptance Criteria:**
- Given `IUnitOfWork` (and its `Products`/`Categories` repositories) is mocked, when Create/Read/Update/Delete `ProductService` methods are tested, then all pass without a live DB connection
- Given the test suite, when `dotnet test` runs, then it exits green
- Given the core CRUD paths, when covered by tests, then at least 2-3 tests exist per FR6 (this spec's matrix specifies 6)

## Verification

**Commands:**
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- `dotnet test` -- expected: all tests pass, zero failures

**Manual checks (if no CLI):**
- `tests/Application.Tests/Services/ProductServiceTests.cs` exists and contains at least 6 `[Fact]`-attributed test methods, one per I/O matrix row

## Suggested Review Order

**Test harness setup**

- Shared mock factory wiring `IUnitOfWork` to mocked `Products`/`Categories` — the pattern every test below builds on.
  [`ProductServiceTests.cs:22`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L22)

**Create coverage**

- Happy path: valid `CategoryId` persists and maps the returned DTO.
  [`ProductServiceTests.cs:35`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L35)

- `CategoryNotFound` branch: invalid `CategoryId` short-circuits before any write.
  [`ProductServiceTests.cs:56`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L56)

**Read coverage**

- `GetByIdAsync` happy path, asserting all four DTO fields.
  [`ProductServiceTests.cs:73`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L73)

- `GetByIdAsync` null-propagation path, added during review.
  [`ProductServiceTests.cs:91`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L91)

- `GetAllAsync` mapping happy path, asserting all four DTO fields per item.
  [`ProductServiceTests.cs:103`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L103)

- `GetAllAsync` empty-repository path, added during review.
  [`ProductServiceTests.cs:123`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L123)

**Update coverage**

- `NotFound` branch: missing product id skips the category lookup and save entirely.
  [`ProductServiceTests.cs:135`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L135)

- `CategoryNotFound` branch, added during review: existing product, invalid `CategoryId`.
  [`ProductServiceTests.cs:152`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L152)

- Success path: both ids valid, changes applied and saved once.
  [`ProductServiceTests.cs:174`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L174)

**Delete coverage**

- Happy path: existing id removes and saves once.
  [`ProductServiceTests.cs:201`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L201)

- `NotFound` path: missing id is a no-op, no remove/save.
  [`ProductServiceTests.cs:217`](../../tests/Application.Tests/Services/ProductServiceTests.cs#L217)

**Peripherals**

- New test project referencing `Application.csproj`, with xUnit + Moq package references.
  [`Application.Tests.csproj:1`](../../tests/Application.Tests/Application.Tests.csproj#L1)

- Solution wiring: new `tests` solution folder nesting `Application.Tests`.
  [`ASPFullStackBMAD.sln:16`](../../ASPFullStackBMAD.sln#L16)
