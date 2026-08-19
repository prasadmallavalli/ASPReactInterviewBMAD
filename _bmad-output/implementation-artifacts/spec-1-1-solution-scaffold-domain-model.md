---
title: 'Solution Scaffold & Domain Model'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No solution exists yet. Every later story (Category/Product CRUD, auth, frontend) needs a compiling, architecturally-correct four-project foundation with the Category/Product domain model and a real MSSQL schema to build against.

**Approach:** Scaffold a Clean Architecture solution (Domain/Application/Infrastructure/Api), define the `Category`/`Product` entities and repository/UoW interfaces in Domain, wire an EF Core `DbContext` in Infrastructure, and generate + apply an initial migration against a local SQL Server 2022 Docker container.

## Boundaries & Constraints

**Always:** Domain has zero project references. Infrastructure is referenced by Api only inside `Program.cs`. `IProductRepository`, `ICategoryRepository`, `IUnitOfWork` are defined in Domain, not implemented yet (implementations land in Stories 1.2/1.3). Entities carry only schema-relevant members — no business logic. Int identity primary keys; no cascade delete configured on the Category→Product FK (Story 1.2 enforces the 409 behavior at the service layer). SQL Server runs via a Docker container (`mcr.microsoft.com/mssql/server:2022-latest`) per the user's confirmed setup choice.

**Ask First:** If Docker Desktop's daemon won't start or the container fails to come up healthy after reasonable retries, stop and ask rather than falling back to SQLite/in-memory. If port 1433 is already in use locally, ask before remapping.

**Never:** No controllers, services, DTOs, or auth in this story — those belong to Stories 1.2 onward. No seed data beyond the schema itself. No `docker-compose` orchestration beyond the single SQL Server service (no app containers yet).

</frozen-after-approval>

## Code Map

Greenfield repo — nothing exists yet at `{project-root}` except `_bmad/`, `_bmad-output/`, `.claude/`, `skills/`. Target structure, per `ARCHITECTURE-SPINE.md`'s Structural Seed:

- `ASPFullStackBMAD.sln` -- solution file referencing all four projects
- `src/Domain/Domain.csproj` -- class library, zero package/project references
- `src/Domain/Entities/Category.cs` -- `Id`, `Name`, `ICollection<Product> Products`
- `src/Domain/Entities/Product.cs` -- `Id`, `Name`, `Price`, `CategoryId`, `Category` nav
- `src/Domain/Interfaces/ICategoryRepository.cs`, `IProductRepository.cs`, `IUnitOfWork.cs` -- empty method signatures for later stories to implement/consume
- `src/Application/Application.csproj` -- class library, references Domain only
- `src/Infrastructure/Infrastructure.csproj` -- references Domain + Application; EF Core + SqlServer packages
- `src/Infrastructure/Data/AppDbContext.cs` -- `DbSet<Category>`, `DbSet<Product>`, Fluent API FK config (Category 1—* Product, `DeleteBehavior.Restrict`)
- `src/Infrastructure/Migrations/` -- initial `dotnet ef migrations add InitialCreate` output
- `src/Api/Api.csproj` -- ASP.NET Core Web API (net10.0), references Application only at project level
- `src/Api/Program.cs` -- composition root; registers `AppDbContext` with the SQL Server connection string; references Infrastructure here only
- `src/Api/appsettings.Development.json` -- local dev connection string (Docker SQL Server, port 1433)
- `docker-compose.yml` -- single `mssql` service, `mcr.microsoft.com/mssql/server:2022-latest`, `ACCEPT_EULA=Y`, dev-only `MSSQL_SA_PASSWORD`, port 1433:1433, named volume for data persistence

## Tasks & Acceptance

**Execution:**
- [x] `docker-compose.yml` -- define the `mssql` service -- gives every story a real, reproducible MSSQL instance to migrate against
- [x] Start Docker Desktop + `docker compose up -d` -- bring the container up and confirm it accepts connections -- required before migrations can apply
- [x] `ASPFullStackBMAD.sln`, `src/Domain/Domain.csproj`, `src/Application/Application.csproj`, `src/Infrastructure/Infrastructure.csproj`, `src/Api/Api.csproj` -- scaffold projects + solution, wire project references per the layering rule -- enforces AD-1 at compile time
- [x] `src/Domain/Entities/Category.cs`, `Product.cs` -- define entities -- the domain model every later story operates on
- [x] `src/Domain/Interfaces/ICategoryRepository.cs`, `IProductRepository.cs`, `IUnitOfWork.cs` -- define interfaces (no implementations yet) -- lets Stories 1.2/1.3 implement against a stable contract (AD-2)
- [x] `src/Infrastructure/Data/AppDbContext.cs` -- DbContext + Fluent API config -- translates the domain model into a real schema
- [x] `src/Api/appsettings.Development.json`, `Program.cs` -- register `AppDbContext` with the Docker connection string -- makes the DbContext resolvable at runtime
- [x] `dotnet ef migrations add InitialCreate -p src/Infrastructure -s src/Api` -- generate the initial migration -- captures the schema as versioned code
- [x] `dotnet ef database update -p src/Infrastructure -s src/Api` -- apply it to the running container -- proves the schema is real, not just compiled

**Acceptance Criteria:**
- Given the solution is built, when project references are inspected, then `Domain` has zero project references and `Infrastructure` is referenced by `Api` only inside `Program.cs`
- Given the entities are defined, when the initial migration is applied, then `Category` and `Product` tables exist in the Dockerized MSSQL instance with the FK relationship (`DeleteBehavior.Restrict`, no cascade)
- Given `ICategoryRepository`, `IProductRepository`, `IUnitOfWork` are defined in Domain, when Infrastructure is inspected, then no implementation exists yet (deferred to Stories 1.2/1.3) and Application/Api reference only the interfaces
- Given `docker compose up -d` has run, when `dotnet ef database update` executes, then it completes without error against the live container

## Design Notes

SA password for the dev container is a local-only placeholder (`***ROTATED-DEV-PASSWORD-REMOVED***`), not a secret — this is a solo portfolio project with no shared/production environment. It lives in `docker-compose.yml` and `appsettings.Development.json`, both fine to commit for this project's purposes.

## Verification

**Commands:**
- `docker compose up -d && docker compose ps` -- expected: `mssql` service healthy
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- `dotnet ef database update -p src/Infrastructure -s src/Api` -- expected: applies cleanly, no pending model changes warning
- `dotnet ef migrations list -p src/Infrastructure -s src/Api` -- expected: shows `InitialCreate` as applied

## Suggested Review Order

**Composition root & layering (AD-1)**

- Entry point — DI registration, connection-string guard added during review (patch: fail fast with a clear message instead of a null-arg crash).
  [`Program.cs:15`](../../src/Api/Program.cs#L15)

**Domain model & contracts (AD-2, AD-3)**

- `Category`/`Product` are schema-only POCOs by design — no business logic lives here (see Design Notes).
  [`Category.cs:8`](../../src/Domain/Entities/Category.cs#L8)

- `Products` setter tightened to `private set` during review — prevents external code from nulling the collection.
  [`Category.cs:18`](../../src/Domain/Entities/Category.cs#L18)

- `Category` FK + required nav property — null at runtime unless a future query `.Include`s it (logged as deferred guidance).
  [`Product.cs:26`](../../src/Domain/Entities/Product.cs#L26)

- Repository/UoW interfaces gained `CancellationToken` parameters during review — standard .NET async convention, cheap to add before any implementation exists.
  [`ICategoryRepository.cs:12`](../../src/Domain/Interfaces/ICategoryRepository.cs#L12)

- Mirrors `ICategoryRepository`'s shape for `Product`.
  [`IProductRepository.cs:12`](../../src/Domain/Interfaces/IProductRepository.cs#L12)

- Coordinates both repositories into one atomic save; implementation deferred to Stories 1.2/1.3.
  [`IUnitOfWork.cs:14`](../../src/Domain/Interfaces/IUnitOfWork.cs#L14)

**Schema & persistence**

- `DeleteBehavior.Restrict` on the Category→Product FK — enforces AD-10's no-cascade rule at the DB level.
  [`AppDbContext.cs:37`](../../src/Infrastructure/Data/AppDbContext.cs#L37)

- `decimal(18,2)` column type for `Price` — avoids floating-point rounding on currency.
  [`AppDbContext.cs:27`](../../src/Infrastructure/Data/AppDbContext.cs#L27)

- Generated migration matches the model exactly — same restrict behavior, same column types.
  [`20260818155358_InitialCreate.cs:44`](../../src/Infrastructure/Migrations/20260818155358_InitialCreate.cs#L44)

**Infra & peripherals**

- Local SQL Server 2022 container per the user's confirmed macOS setup choice; `restart: unless-stopped` added during review.
  [`docker-compose.yml:4`](../../docker-compose.yml#L4)

- Dev-only connection string/password, intentionally committable per Design Notes.
  [`appsettings.Development.json:9`](../../src/Api/appsettings.Development.json#L9)

- Added during review to keep build artifacts and local-only files out of any future commit.
  [`.gitignore:1`](../../.gitignore#L1)
