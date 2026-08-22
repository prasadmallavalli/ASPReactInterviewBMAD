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

## Spec Change Log

- **(Renegotiated 2026-08-22, Epic 1 retrospective, Finding C)** The frozen Boundaries & Constraints text above says the middleware is registered "immediately after `UseExceptionHandler()`" and that the correlation-ID value "is set on the response headers before the downstream pipeline runs." The shipped implementation does the opposite on both counts, and always has — this entry formally records the deviation, which was previously explained only in the (non-frozen) Suggested Review Order section and the middleware's own code comments, with no Spec Change Log entry the way specs 2.1-2.3 use for their own renegotiations.
  - **Registration order:** the middleware is registered *before* `UseExceptionHandler()`, not after. Registering after would mean an unhandled exception unwinds past (and closes) the correlation-ID log scope before the exception handler's own catch block — and its unhandled-exception log line — ever runs, which is the single log line a postmortem needs most tied to a correlation ID. `Program.cs`'s own comment documents this explicitly, confirmed against ASP.NET Core's `ExceptionHandlerMiddlewareImpl` source.
  - **Header-write timing:** the correlation-ID response header is set inside a `Response.OnStarting(...)` callback, not immediately. `UseExceptionHandler`'s own exception handling calls `Response.Clear()` (which clears response headers unconditionally) before writing the `ProblemDetails` body on a 500 — an immediate header write would still get wiped by that clear. `OnStarting` fires right before the response is actually sent, after any such clearing has already happened, so the header survives on every response, including error ones. This was originally verified only by forcing a real unhandled exception against the running app by hand; Epic 1's retrospective added an automated regression test for it (`tests/Application.Tests/Integration/CorrelationIdMiddlewareTests.cs`).
  - Net effect: both deviations exist for the same reason — the frozen text's literal instructions would have silently dropped the correlation ID from exactly the responses a postmortem needs it most (error responses), which is the opposite of this story's own stated goal. The implementation satisfies the *intent* (every response, including errors, carries the correlation ID) by doing the reverse of what the frozen *mechanism* text specified.

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
