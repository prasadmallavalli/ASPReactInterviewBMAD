---
title: 'Category CRUD'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.1 scaffolded the solution and defined `ICategoryRepository`/`IProductRepository`/`IUnitOfWork` as contracts only — no implementation, no service layer, no endpoints. There is no way to manage the Category taxonomy yet.

**Approach:** Implement Create/Read(list+by-id)/Update/Delete for Category through a full vertical slice: DTOs + manual mapping (AD-9), `CategoryService` (business rule: reject delete when Products exist), `CategoryRepository` (AD-2), and a `CategoriesController`. `IUnitOfWork` requires both `Categories` and `Products` repository properties to compile, so this story also implements `ProductRepository` as thin, mechanical data-access plumbing (mirrors `CategoryRepository`, zero business logic) — Story 1.3 builds the Product *service, DTOs, and controller* on top of it. No new interface design here; both repository interfaces already exist from Story 1.1.

## Boundaries & Constraints

**Always:** Controller depends only on `ICategoryService`, never `ICategoryRepository`/`DbContext` (AD-1). Service depends only on `ICategoryRepository`/`IUnitOfWork` interfaces, never EF Core directly (AD-2). Domain entities never cross the controller boundary — only DTOs (AD-3), mapped via manual `ToDto()`/`ToEntity()` extension methods, no AutoMapper (AD-9). Request DTOs use Data Annotations, validated automatically by `[ApiController]`'s model-state (AD-8) — no FluentValidation. All repositories/services/UnitOfWork registered Scoped (AD-4). Deleting a Category with existing Products returns `409 Conflict` via an explicit `HasProductsAsync` check — never relies on catching the DB's FK-restrict error (AD-10). Routes are lowercase-plural kebab (`/api/categories`).

**Ask First:** If satisfying `IUnitOfWork`'s shape surfaces any design question in `ProductRepository` beyond mechanical CRUD mirroring `CategoryRepository`, stop and ask rather than guessing at Product-specific behavior (that belongs to Story 1.3).

**Never:** No Product controller, service, or DTOs in this story. No auth/`[Authorize]` (Epic 2). No pagination on the list endpoint. No changes to the `Category`/`Product` entities or the existing migration.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create valid | `{ "name": "Widgets" }` | 201 + `CategoryDto`, `Location` header | N/A |
| Create invalid | `{ "name": "" }` or missing | 400 `ValidationProblemDetails` | Auto via `[ApiController]` |
| Get by id, missing | `id` not in DB | 404 | N/A |
| Update, missing | `id` not in DB | 404 | N/A |
| Delete, has Products | Category with ≥1 Product | 409 `ProblemDetails` | No delete attempted |
| Delete, no Products | Category with 0 Products | 204 | N/A |
| Delete, missing | `id` not in DB | 404 | N/A |

</frozen-after-approval>

## Code Map

- `src/Domain/Interfaces/ICategoryRepository.cs` -- add `Task<bool> HasProductsAsync(int categoryId, CancellationToken ct = default)`
- `src/Domain/Interfaces/IProductRepository.cs` -- existing (Story 1.1), implemented here, no changes
- `src/Infrastructure/Repositories/CategoryRepository.cs` -- new, implements `ICategoryRepository` against `AppDbContext`
- `src/Infrastructure/Repositories/ProductRepository.cs` -- new, implements `IProductRepository` (plumbing only, see Intent)
- `src/Infrastructure/UnitOfWork.cs` -- new, implements `IUnitOfWork` (`Categories`, `Products`, `SaveChangesAsync` wrapping `AppDbContext.SaveChangesAsync`)
- `src/Application/DTOs/CategoryDto.cs` -- response shape: `Id`, `Name`
- `src/Application/DTOs/CategoryRequestDto.cs` -- request shape (Create + Update, identical fields): `[Required][StringLength(200)] Name`
- `src/Application/Mappers/CategoryMapper.cs` -- `ToDto()` / `ToEntity()` extension methods
- `src/Application/Services/ICategoryService.cs` -- new interface: `GetByIdAsync`, `GetAllAsync`, `CreateAsync`, `UpdateAsync`, `DeleteAsync`
- `src/Application/Services/CategoryService.cs` -- new, the 409 business rule lives here via `HasProductsAsync`
- `src/Api/Controllers/CategoriesController.cs` -- new, `[ApiController]` + `[Route("api/categories")]`
- `src/Api/Program.cs` -- add `AddProblemDetails()` and Scoped DI registrations for the four new interfaces

## Tasks & Acceptance

**Execution:**
- [x] `src/Domain/Interfaces/ICategoryRepository.cs` -- add `HasProductsAsync` -- lets the service check the 409 condition without loading the full Product set
- [x] `src/Infrastructure/Repositories/CategoryRepository.cs`, `ProductRepository.cs`, `UnitOfWork.cs` -- implement the three interfaces -- unblocks the service layer and satisfies `IUnitOfWork`'s shape
- [x] `src/Application/DTOs/CategoryDto.cs`, `CategoryRequestDto.cs`, `Mappers/CategoryMapper.cs` -- DTO boundary + manual mapping -- enforces AD-3/AD-9
- [x] `src/Application/Services/ICategoryService.cs`, `CategoryService.cs` -- CRUD + 409 business rule -- the only thing the controller may depend on
- [x] `src/Api/Controllers/CategoriesController.cs` -- REST endpoints -- exposes the vertical slice over HTTP
- [x] `src/Api/Program.cs` -- `AddProblemDetails()` + DI registrations -- wires everything together, enforces AD-4 lifetimes
- [x] Unit-test the I/O matrix rows against a running `CategoryService` (real repository against the Docker MSSQL instance is acceptable at this stage; Story 1.6 adds the mocked-repository xUnit suite)

**Acceptance Criteria:**
- Given the controller, when inspected, then it calls only `ICategoryService` — never `DbContext` or `ICategoryRepository` directly
- Given a full create → get → update → delete cycle against the running API, when exercised, then every response matches the I/O matrix

## Verification

**Commands:**
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- `dotnet run --project src/Api` + manual `curl` pass through the I/O matrix rows -- expected: status codes and bodies match

## Suggested Review Order

**Composition root & error envelope**

- `UseExceptionHandler()` added during review — closes the gap where `AddProblemDetails()` alone doesn't shape unhandled 500s.
  [`Program.cs:45`](../../src/Api/Program.cs#L45)

**Controller**

- Depends only on `ICategoryService` (AD-1) — thin, all branching delegates to the service's `CategoryDeleteResult`.
  [`CategoriesController.cs:19`](../../src/Api/Controllers/CategoriesController.cs#L19)

- 409 path switched from a hand-built `ProblemDetails` literal to `Problem()` during review — picks up `traceId`/`type` consistently.
  [`CategoriesController.cs:75`](../../src/Api/Controllers/CategoriesController.cs#L75)

**Service — the 409 business rule (AD-10)**

- Explicit not-found-then-`HasProductsAsync` check before delete, never a caught FK-restrict error.
  [`CategoryService.cs:60`](../../src/Application/Services/CategoryService.cs#L60)

**Unit of Work — DI wiring fix**

- Constructor changed during review to take `ICategoryRepository`/`IProductRepository` as parameters instead of `new`-ing them directly — the Program.cs `AddScoped` registrations for both interfaces were previously dead code.
  [`UnitOfWork.cs:19`](../../src/Infrastructure/UnitOfWork.cs#L19)

**DTO validation**

- `[Required]`/`[StringLength(200)]` on `Name` — `[ApiController]` turns a violation into an automatic 400 (AD-8).
  [`CategoryRequestDto.cs:13`](../../src/Application/DTOs/CategoryRequestDto.cs#L13)

**Mapping (AD-9)**

- Manual `ToDto()`/`ToEntity()`/`ApplyTo()` — no AutoMapper, keeps the DTO boundary explicit.
  [`CategoryMapper.cs:14`](../../src/Application/Mappers/CategoryMapper.cs#L14)
