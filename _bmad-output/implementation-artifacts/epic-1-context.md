# Epic 1 Context: CRUD API Foundation

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic scaffolds the layered .NET solution and delivers full Create/Read/Update/Delete for a Product/Category catalog (one-to-many) against a real MSSQL instance, with the core architecture invariants — dependency injection, DTO boundaries, correlation-ID logging — wired in from the start rather than retrofitted. It is the technical spine every later epic (auth, frontend) builds on top of, and the source of a deliberately reproduced DI bug that later becomes real input for a postmortem artifact.

## Stories

- Story 1.1: Solution Scaffold & Domain Model
- Story 1.2: Category CRUD
- Story 1.3: Product CRUD
- Story 1.4: Correlation ID & Structured Logging
- Story 1.5: Deliberate DI Lifetime Bug (Reproduce → Observe → Fix)
- Story 1.6: Unit Tests for ProductService

## Requirements & Constraints

- Full CRUD (create, read list + by-id, update, delete) for Category and Product, backed by EF Core migrations against a real MSSQL instance (LocalDB/Developer edition).
- Correct HTTP status codes across all endpoints: 201/200/204 on success, 400 on invalid input, 404 on a missing resource — never a 500 for expected failure cases.
- Controllers, services, and data access are separated via constructor-injected interfaces, registered with correct DI lifetimes; no controller talks to the database directly.
- The API never returns EF entities; request/response shapes are DTOs, validated before reaching business logic. Invalid input returns 400 with a structured error body. No over-posting or circular-reference vulnerability is reachable through the public surface.
- Structured logging carries a correlation ID through every request's full lifecycle (this seeds a later incident postmortem's timeline).
- Automated xUnit unit tests exist for the Product service layer with the repository mocked — at least 2-3 tests covering create/read/update/delete — and `dotnet test` runs green.
- Every non-trivial file carries comments explaining *why* a decision was made, not what the code does; this applies to all code produced in this epic.

## Technical Decisions

- Four-project Clean Architecture solution, dependencies pointing inward: **Domain** (entities, repository/Unit-of-Work interfaces — zero project references) ← **Application** (services, DTOs, manual mappers — depends only on Domain) ← **Infrastructure** (DbContext, repository/UoW implementations, migrations) ← **Api** (controllers, middleware, `Program.cs` composition root). Api may reference Infrastructure only inside `Program.cs`'s DI registration, never from a controller.
- Repository + Unit of Work pattern: `IProductRepository`/`IUnitOfWork` live in Domain, implemented in Infrastructure; services depend only on the interfaces.
- DI lifetimes: `DbContext` and repositories are Scoped; application services are Scoped by default (only framework logging/config are Singleton). A deliberate, one-time scoped-into-singleton violation must be reproduced, observed failing under concurrent requests, then fixed — this is intentional, documented input for a later postmortem artifact, not a standing exception to the rule.
- DTO boundary: Domain entities never appear in a controller's request/response types. DTOs and manual `ToDto()`/`ToEntity()` extension methods live in Application — no AutoMapper.
- Validation: Data Annotations on DTOs, enforced automatically via `[ApiController]` model-state validation (auto 400 + `ProblemDetails`) — no FluentValidation.
- Category deletion: deleting a Category with existing Products returns `409 Conflict`; no cascade delete.
- All 4xx/5xx responses use an RFC 7807 `ProblemDetails` error envelope, including unhandled exceptions caught by global middleware.
- Correlation-ID middleware generates `X-Correlation-Id` if absent (or preserves an existing one) and attaches it to the `ILogger` scope for that request's lifetime; every log line emitted during the request includes it.
- Conventions: int identity primary keys; UTC ISO 8601 dates (`System.Text.Json` default); PascalCase C# types/interfaces; lowercase-plural kebab API routes (e.g. `/api/products`); mutation flows only through Application services, never repository calls from controllers.
- Stack: .NET/ASP.NET Core 10, EF Core 10.x, SQL Server (LocalDB/Developer edition), xUnit + Moq for tests (exact patch versions pinned at scaffold time).

## Cross-Story Dependencies

- Story 1.1 (solution scaffold, entities, repository/UoW interfaces, initial migration) is a prerequisite for every other story in this epic.
- Story 1.4's correlation-ID logging must be in place before Story 1.5's DI bug is reproduced, since the failure needs to be observed and logged with a correlation ID attached.
- Story 1.5's bug reproduction and fix (and its saved log excerpt) become required input for a later epic's blameless postmortem artifact — the failure must actually be observed and documented, not simulated.
- Story 1.6 depends on the Product CRUD service (Story 1.3) existing to test against.
- A later epic adds `[Authorize]` protection and CORS scoping on top of the mutation endpoints built here; this epic's endpoints are intentionally unauthenticated at this stage.
