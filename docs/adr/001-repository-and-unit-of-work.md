# ADR-001: Repository + Unit of Work over Application/Api

Status: Accepted
Date: 2026-08-18 (Story 1.1-1.3) · Deciders: Prasadmallavalli
Related: [ADR-005](005-category-delete-conflict-no-cascade.md) (same unhandled-500 gap in Consequences, from the opposite direction)

## Context

Story 1.1 scaffolded a four-project Clean Architecture solution (Domain / Application / Infrastructure / Api) and defined `ICategoryRepository`, `IProductRepository`, and `IUnitOfWork` in Domain as contracts only, with no implementation. Story 1.2 implemented them in Infrastructure (`CategoryRepository`, `ProductRepository`, `UnitOfWork`) and built `CategoryService` against the interfaces only; Story 1.3 mirrored the pattern for `ProductService`. The goal (AD-2, [`ARCHITECTURE-SPINE.md`](../../_bmad-output/planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md)) was to keep `Application` and `Api` from depending on EF Core or `DbContext` directly, and to make the service layer mockable — `tests/Application.Tests` (Story 1.6+) mocks `IUnitOfWork` with Moq rather than standing up a real database.

## Decision

Define `ICategoryRepository`, `IProductRepository`, and `IUnitOfWork` in Domain; implement them in Infrastructure against `AppDbContext`. `CategoryService`/`ProductService`/`UserService` depend only on these interfaces via constructor injection, never on `DbContext` or an EF Core type.

## Alternatives

- **Inject `AppDbContext` directly into services.** Simpler, fewer files, and honestly closer to how much of the ASP.NET Core community actually builds small APIs — EF Core's `DbContext`/`DbSet<T>` already *is* a Unit-of-Work/repository implementation internally, so wrapping it in another repository layer is a well-known point of debate, not an uncontested best practice. For a solo project with one entity model and no plan to swap ORMs, the abstraction's main paying job is making Moq-based unit tests possible without a real database — a real but narrow benefit, not evidence the pattern was strictly necessary. **Rejected anyway**, because AD-2 already committed to the interfaces before this ADR was written and the Moq-based unit tests (Story 1.6+) now depend on that seam existing — reversing it would mean rewriting `tests/Application.Tests` against a real or in-memory `DbContext`.
- **Generic `IRepository<T>`.** Rejected as premature abstraction for two related entities with different query needs (`HasProductsAsync` on Category has no Product equivalent).

## Consequences

- Services are unit-testable with mocked `IUnitOfWork`, and the compiler enforces that Application/Api never reference EF Core types outside `Program.cs`'s composition root.
- The abstraction has a real, documented cost: because `Application` cannot depend on EF Core, it cannot catch `DbUpdateException` to translate a database-level failure into a clean HTTP response. This is why the check-then-act races logged in [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) (Category delete, Product create/update, User registration) surface as unhandled 500s instead of clean 409/400s in their narrow race windows — the proper fix (a Domain-level exception type Infrastructure translates the EF exception into) was identified but not built, because it's a small design decision outside each story's approved scope.
- For this project's actual scale (two-to-three entities, single developer, local dev only), the abstraction is arguably more ceremony than the codebase needs today; its value is mostly forward-looking (testability, interview legibility) rather than solving a live pain point.
