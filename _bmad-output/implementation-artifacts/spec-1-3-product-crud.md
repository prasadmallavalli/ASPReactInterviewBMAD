---
title: 'Product CRUD'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `ProductRepository` exists only as thin plumbing (Story 1.2, to satisfy `IUnitOfWork`'s shape) — there is no service, DTOs, or endpoints to manage Products yet.

**Approach:** Mirror Story 1.2's Category vertical slice for Product: DTOs + manual mapping (AD-9), `ProductService`, `ProductsController`. The one new business rule Product introduces: Create/Update must verify the referenced `CategoryId` exists before writing — returns `400` (bad request, not a caught FK error) when it doesn't. This is also where `Price`'s missing validation (flagged and explicitly deferred during Story 1.1's review, since Domain stays schema-only per AD-8) finally lands, as `[Range]` on the request DTO.

## Boundaries & Constraints

**Always:** Controller depends only on `IProductService` (AD-1). Service depends only on `IUnitOfWork` (AD-2), never EF Core/`DbContext`. DTOs only cross the controller boundary (AD-3), manual `ToDto()`/`ToEntity()`/`ApplyTo()` (AD-9), no AutoMapper. `[Required]`/`[StringLength(200)]` on `Name`, `[Range(0.01, 1000000)]` on `Price` (AD-8). All new registrations Scoped (AD-4). Missing `CategoryId` reference returns `400` via an explicit existence check — never a caught FK error. Routes: `/api/products`.

**Ask First:** None anticipated — this story mirrors an already-approved pattern (Story 1.2) with no new architectural surface.

**Never:** No changes to `Category`/`ICategoryRepository`/`ProductRepository` (all already correct from Stories 1.1/1.2). No auth (Epic 2). No pagination.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create valid | `{"name":"Widget","price":9.99,"categoryId":1}`, Category 1 exists | 201 + `ProductDto`, `Location` header | N/A |
| Create, bad Category | `categoryId` not in DB | 400 `ProblemDetails` | Explicit existence check, not a caught FK error |
| Create invalid | Missing name, or `price <= 0` | 400 `ValidationProblemDetails` | Auto via `[ApiController]` |
| Get by id, missing | `id` not in DB | 404 | N/A |
| Update, missing | `id` not in DB | 404 | N/A |
| Update, bad Category | `categoryId` not in DB | 400 `ProblemDetails` | Same explicit check as create |
| Delete, missing | `id` not in DB | 404 | N/A |
| Delete, exists | `id` in DB | 204 | N/A |

</frozen-after-approval>

## Code Map

- `src/Application/DTOs/ProductDto.cs` -- response: `Id`, `Name`, `Price`, `CategoryId`
- `src/Application/DTOs/ProductRequestDto.cs` -- request: `Name` (`[Required][StringLength(200)]`), `Price` (`[Range(0.01, 1000000)]`), `CategoryId`
- `src/Application/Mappers/ProductMapper.cs` -- `ToDto()`/`ToEntity()`/`ApplyTo()`, mirrors `CategoryMapper.cs`
- `src/Application/Services/IProductService.cs` -- new: `GetByIdAsync`, `GetAllAsync`, `CreateAsync`, `UpdateAsync`, `DeleteAsync`
- `src/Application/Services/ProductService.cs` -- new; `Create`/`UpdateAsync` check `_unitOfWork.Categories.GetByIdAsync(categoryId)` before writing
- `src/Api/Controllers/ProductsController.cs` -- new, `[Route("api/products")]`, depends only on `IProductService`
- `src/Api/Program.cs` -- add `AddScoped<IProductService, ProductService>()`
- `src/Infrastructure/Repositories/ProductRepository.cs` -- existing (Story 1.2), read-only reference, no changes

## Tasks & Acceptance

**Execution:**
- [x] `src/Application/DTOs/ProductDto.cs`, `ProductRequestDto.cs`, `Mappers/ProductMapper.cs` -- DTO boundary + mapping -- enforces AD-3/AD-9/AD-8
- [x] `src/Application/Services/IProductService.cs`, `ProductService.cs` -- CRUD + Category-existence rule -- the only thing the controller may depend on
- [x] `src/Api/Controllers/ProductsController.cs` -- REST endpoints -- exposes the vertical slice over HTTP
- [x] `src/Api/Program.cs` -- `AddScoped<IProductService, ProductService>()` -- wires the new service (repository/UnitOfWork already registered in Story 1.2)
- [x] Verify every I/O matrix row against the running API (real repository against the Docker MSSQL instance, same as Story 1.2; Story 1.6 adds the mocked-repository xUnit suite)

**Acceptance Criteria:**
- Given the controller, when inspected, then it calls only `IProductService` — never `DbContext` or a repository directly
- Given a full create → get → update → delete cycle against the running API, when exercised, then every response matches the I/O matrix

## Verification

**Commands:**
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- `dotnet run --project src/Api` + manual `curl` pass through the I/O matrix rows -- expected: status codes and bodies match

## Suggested Review Order

**Controller**

- Depends only on `IProductService` (AD-1); branches on `ProductWriteResult` for the one new decision this story adds.
  [`ProductsController.cs:21`](../../src/Api/Controllers/ProductsController.cs#L21)

- `CategoryNotFound` → `Problem(400, ...)`, reusing the `Problem()`-helper pattern fixed during Story 1.2's review.
  [`ProductsController.cs:73`](../../src/Api/Controllers/ProductsController.cs#L73)

**Service — the new business rule**

- `CreateAsync`: explicit `Categories.GetByIdAsync` existence check before any write, never a caught FK error.
  [`ProductService.cs:42`](../../src/Application/Services/ProductService.cs#L42)

- `UpdateAsync`: same rule, plus the not-found-product check Story 1.2 established.
  [`ProductService.cs:61`](../../src/Application/Services/ProductService.cs#L61)

**Mapping (AD-9)**

- `ToEntity` takes the already-loaded `Category` rather than re-querying; `ApplyTo` only touches the `CategoryId` scalar, relying on EF's FK-scalar change tracking.
  [`ProductMapper.cs:34`](../../src/Application/Mappers/ProductMapper.cs#L34)

**DTO validation**

- `[Range(0.01, 1000000)]` on `Price` — the validation flagged and deferred since Story 1.1, finally landing here.
  [`ProductRequestDto.cs:20`](../../src/Application/DTOs/ProductRequestDto.cs#L20)
