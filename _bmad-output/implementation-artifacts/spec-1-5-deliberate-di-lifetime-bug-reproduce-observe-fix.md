---
title: 'Deliberate DI Lifetime Bug (Reproduce -> Observe -> Fix)'
type: 'bugfix'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-4's "DbContext/repositories = Scoped" rule is currently only a written rule, not something the project has ever seen fail. FR9's postmortem needs a real, observed captive-dependency incident — not a hypothetical — as its subject.

**Approach:** Temporarily register `IProductRepository` as Singleton (captive dependency over the Scoped `AppDbContext`), run the API outside Development (where ASP.NET Core's default DI scope validation would otherwise catch this at startup and mask the real bug), hammer `GET /api/products` with concurrent requests until EF Core's thread-safety exception fires, save the correlation-ID-tagged log excerpt for FR9, then revert to Scoped.

## Boundaries & Constraints

**Always:** Reproduce against the real MSSQL instance (docker-compose), not a simulated failure. Run with `ASPNETCORE_ENVIRONMENT=Production` (plus an explicit `ConnectionStrings__DefaultConnection` env var, since that connection string otherwise only lives in `appsettings.Development.json`) — Development's default `ValidateScopes`/`ValidateOnBuild` would throw immediately on first resolution instead of letting the race condition occur. Capture the failing console output verbatim (including its `X-Correlation-Id`, per Story 1.4's `BeginScope`) into a new saved artifact for later FR9 reuse. End state must have `IProductRepository` back on `AddScoped`, with a why-comment referencing AD-4 and the saved log excerpt.

**Ask First:** None anticipated.

**Never:** No change to `CategoryRepository`'s lifetime, or to `ProductRepository`/`ProductService`/`ProductsController` code — this is a DI-registration-only bug. Never leave the Singleton registration in the code after reproduction is captured.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Buggy (pre-fix) | `IProductRepository` Singleton; concurrent `GET /api/products` bursts | EF Core captive-dependency exception observed and logged with a correlation ID | Failure captured to log excerpt file, not silently retried |
| Fixed (post-fix) | `IProductRepository` Scoped; same concurrent burst | All requests return 200, no exceptions | N/A |

</frozen-after-approval>

## Code Map

- `src/Api/Program.cs:34` -- `builder.Services.AddScoped<IProductRepository, ProductRepository>();` -- flip to `AddSingleton` to reproduce, then revert to `AddScoped` as the fix, with an added why-comment
- `src/Api/Middleware/CorrelationIdMiddleware.cs` -- already attaches correlation ID to `ILogger` scope (Story 1.4); no changes, just relied upon so the captured log excerpt has a correlation ID
- `src/Api/appsettings.Development.json` -- holds `ConnectionStrings:DefaultConnection`, which is Development-only; reproduction must pass the same value via `ConnectionStrings__DefaultConnection` env var since repro runs outside Development
- New: `_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md` -- saved verbatim failure log + correlation ID + repro command, for FR9's later postmortem

## Tasks & Acceptance

**Execution:**
- [x] `src/Api/Program.cs:34` -- change `AddScoped<IProductRepository, ProductRepository>()` to `AddSingleton<IProductRepository, ProductRepository>()` -- sets up the captive-dependency condition AD-4 forbids
- [x] Run `docker compose up -d` -- ensures reproduction hits a real MSSQL instance, not a mock
- [x] Run `ASPNETCORE_ENVIRONMENT=Production ConnectionStrings__DefaultConnection="Server=localhost,1433;Database=ASPFullStackBMAD;User Id=sa;Password=***ROTATED-DEV-PASSWORD-REMOVED***;TrustServerCertificate=True" dotnet run --project src/Api --no-launch-profile` -- bypasses Development's eager scope validation so the bug survives to runtime (note: `--no-launch-profile` skips `launchSettings.json`'s `applicationUrl`, so Kestrel bound port 5000, not 5087 -- see log excerpt file for detail)
- [x] Fire a concurrent burst at `GET /api/products` (e.g. `seq 1 50 | xargs -P 50 -I{} curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5087/api/products`) -- forces overlapping use of the singleton-captured `AppDbContext` (ran against port 5000; 48/50 requests returned 500)
- [x] Save the failing console output (exception + correlation ID) verbatim to `_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md` -- required FR9 postmortem input
- [x] `src/Api/Program.cs:34` -- revert to `AddScoped<IProductRepository, ProductRepository>()` with a why-comment citing AD-4 and the log excerpt file -- closes the deliberate exception with no standing violation
- [x] Re-run the same concurrent burst against the fixed registration -- confirms the fix (ran twice, 50/50 200s each time, zero exceptions logged)

**Acceptance Criteria:**
- Given a repository is temporarily registered as Singleton while depending on a Scoped `DbContext`, when two concurrent requests hit it, then a captive-dependency failure is observed and logged with a correlation ID
- Given the failure is documented (log excerpt saved for FR9), when the fix is applied, then the repository is correctly Scoped and the failure no longer reproduces
- Given the fix is in place, when DI lifetimes are reviewed, then AD-4's rule holds with no standing exception

### Review Findings

- [x] [Review][Patch] Permanently enable `ValidateScopes`/`ValidateOnBuild` on the DI container outside Development — catches future captive-dependency misregistrations at build time in any environment; user confirmed adding it now [src/Api/Program.cs:9]
- [x] [Review][Patch] Log excerpt "Fix" section cites wrong line number for the reverted registration (says line 34, which is the why-comment; the actual `AddScoped` call is line 42) [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md:212]
- [x] [Review][Patch] Log excerpt "Result" section documents only one post-fix confirmation run, but the spec's task checklist states the burst was run twice (50/50 both times) — artifact under-documents what was actually executed [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md:51]
- [x] [Review][Patch] "Verbatim console output" section shows only a partial excerpt (~12 of 48 failing requests, 1 of 48 unhandled-exception blocks) without noting it's partial, reading as if complete [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md:63]
- [x] [Review][Patch] "Correlation ID" section presents one ID as if it covers the whole incident, but the captured log contains a distinct correlation ID per failed request — needs to clarify it's the ID for the one highlighted unhandled-exception trace [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md:59]
- [x] [Review][Defer] No automated regression test (or DI-container lifetime assertion) protects against this captive-dependency bug reappearing [src/Api/Program.cs:42] — deferred, pre-existing scope gap; no test project exists in the solution yet, and Epic 1's own context assigns automated xUnit tests to Story 1.6, not this DI-registration-only bugfix
- [x] [Review][Defer] Real SQL Server credential (`sa`/`***ROTATED-DEV-PASSWORD-REMOVED***`) appears in the committed log excerpt [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md:36] — deferred, pre-existing; the same credential was already committed in `docker-compose.yml` and `appsettings.Development.json` since Story 1.1
- [x] [Review][Defer] Log excerpt lacks "Impact"/"Prevention" sections useful for the eventual FR9 postmortem [_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md] — deferred, pre-existing scope gap; not required by this story's I/O matrix, better raised when Epic 5's postmortem story is built
- [x] [Review][Defer] Connection string is null-checked but not checked for empty/whitespace [src/Api/Program.cs:25] — deferred, pre-existing; code untouched by this story's diff, dates to Story 1.1's scaffold
- [x] [Review][Defer] `Microsoft.OpenApi` 2.0.0 has a known high-severity NuGet advisory (GHSA-v5pm-xwqc-g5wc), surfaced as a build warning during review verification [src/Api/Api.csproj] — deferred, pre-existing; dependency pinned since Story 1.1's scaffold, not touched by this story

## Verification

**Commands:**
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- Manual repro sequence above -- expected: exception + correlation ID observed pre-fix; all 200s, no exceptions, post-fix

**Manual checks (if no CLI):**
- `_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md` exists and contains a real exception trace with a correlation ID, not a fabricated one
