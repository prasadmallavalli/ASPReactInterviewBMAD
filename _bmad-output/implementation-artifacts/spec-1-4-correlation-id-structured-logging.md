---
title: 'Correlation ID & Structured Logging'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing currently ties a request's log lines together. There's no way to reconstruct a request's full lifecycle from logs — which is exactly what Story 1.5's postmortem will need to do for the deliberately-reproduced DI bug.

**Approach:** A composition-root middleware reads `X-Correlation-Id` if the client sent one, otherwise generates a new one, echoes it back as a response header, and wraps the rest of the pipeline in an `ILogger` scope carrying that ID — so every log line emitted during the request (framework and future application logging alike) includes it automatically, with no per-call-site plumbing required (AD-6).

## Boundaries & Constraints

**Always:** Middleware registered immediately after `UseExceptionHandler()` so it covers the whole request, including error responses. `X-Correlation-Id` request header is preserved verbatim if present and non-empty; otherwise a new GUID is generated. The value is set on the response headers before the downstream pipeline runs. The correlation ID is attached via `ILogger.BeginScope`, not passed as an explicit parameter to every log call — this only works end-to-end if the console logger is configured with `IncludeScopes: true`, which this story must also set.

**Ask First:** None anticipated — this is additive middleware with no business-logic surface.

**Never:** No changes to `CategoryService`/`ProductService`/controllers. No structured-logging sink beyond the console (file/DB/OTEL exporters are out of scope). No correlation-id persistence to the database.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No header | Request has no `X-Correlation-Id` | A new GUID is generated; response echoes it; log lines for the request include it | N/A |
| Header present | `X-Correlation-Id: abc-123` | `abc-123` is preserved and echoed; log lines include `abc-123` | N/A |
| Empty header | `X-Correlation-Id: ` (empty string) | Treated as absent — a new GUID is generated | N/A |

</frozen-after-approval>

## Code Map

- `src/Api/Middleware/CorrelationIdMiddleware.cs` -- new: reads/generates the ID, sets the response header, wraps `_next(context)` in `logger.BeginScope(...)`
- `src/Api/Program.cs` -- add `app.UseMiddleware<CorrelationIdMiddleware>();` right after `app.UseExceptionHandler();`
- `src/Api/appsettings.json` -- add `"Logging": { "Console": { "IncludeScopes": true } }` so scope data (the correlation ID) actually reaches console output

## Tasks & Acceptance

**Execution:**
- [x] `src/Api/Middleware/CorrelationIdMiddleware.cs` -- implement per the I/O matrix -- the whole story's deliverable
- [x] `src/Api/Program.cs` -- register the middleware right after `UseExceptionHandler()` -- ensures it wraps error responses too
- [x] `src/Api/appsettings.json` -- `Logging:Console:IncludeScopes: true` -- without this, `BeginScope` data is silently dropped from console output and AC3 can't actually be observed

**Acceptance Criteria:**
- Given a request without `X-Correlation-Id`, when it arrives, then middleware generates one, attaches it to the `ILogger` scope for that request, and echoes it on the response
- Given a request with `X-Correlation-Id` already set, when it arrives, then the existing value is preserved, used, and echoed
- Given any log line emitted during the request (e.g. the framework's routing/endpoint logs), when console output is inspected, then it includes the correlation ID

## Verification

**Commands:**
- `dotnet build ASPFullStackBMAD.sln` -- expected: builds with zero errors
- `dotnet run --project src/Api` + `curl -i` (with and without `X-Correlation-Id`) while watching console output -- expected: response header present, request-scoped log lines show the matching ID

## Suggested Review Order

**Middleware ordering (the review's key finding)**

- Registered before `UseExceptionHandler()`, not after — the doc comment explains why the reverse order silently drops the correlation ID from both the exception handler's own log line and the 500 response header.
  [`Program.cs:52`](../../src/Api/Program.cs#L52)

**The middleware itself**

- `OnStarting` (not an immediate header write) — survives `UseExceptionHandler`'s unconditional `Response.Clear()` on a 500, confirmed by forcing a real unhandled exception against the running app.
  [`CorrelationIdMiddleware.cs:44`](../../src/Api/Middleware/CorrelationIdMiddleware.cs#L44)

- `BeginScope` is what makes this "no per-call-site plumbing" — every log line during the request picks up the ID automatically.
  [`CorrelationIdMiddleware.cs:57`](../../src/Api/Middleware/CorrelationIdMiddleware.cs#L57)

**Config**

- `Console:IncludeScopes: true` — without this, scope data (the correlation ID) never reaches console output at all.
  [`appsettings.json:8`](../../src/Api/appsettings.json#L8)
