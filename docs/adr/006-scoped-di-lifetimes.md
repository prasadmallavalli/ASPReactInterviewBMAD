# ADR-006: Scoped DI Lifetimes, With a Deliberately Reproduced Captive-Dependency Bug

Status: Accepted
Date: 2026-08-19 (Story 1.5); `ValidateScopes`/`ValidateOnBuild` guardrail added post-review, same story · Deciders: Prasadmallavalli

## Context

AD-4 states the project's DI lifetime rule: `DbContext` and repositories are `Scoped`; application services are `Scoped` by default; only genuinely stateless, framework-provided types (`ILogger`, `IConfiguration`, `IPasswordHasher<User>`) are `Singleton`. FR-9 required this rule to be backed by a real, observed incident rather than a hypothetical for the eventual blameless postmortem.

Story 1.5 deliberately registered `IProductRepository` as `AddSingleton` instead of `AddScoped`, ran the API with `ASPNETCORE_ENVIRONMENT=Production` (to bypass Development's default `ValidateScopes`/`ValidateOnBuild`, which would otherwise throw immediately at startup and mask the real runtime failure), and fired 50 concurrent `GET /api/products` requests at it.

48 of 50 failed with `System.InvalidOperationException: A second operation was started on this context instance before a previous operation completed` — EF Core's `ConcurrencyDetector` catching the Scoped `AppDbContext` being reused, unsafely, by every request because the Singleton-lifetime repository captured and held onto one instance for the app's entire lifetime. The failure, with correlation IDs and full stack traces, is saved verbatim in [`story-1-5-di-bug-log-excerpt.md`](../../_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md).

The registration was then reverted to `AddScoped` with a why-comment citing AD-4, and the identical 50-request burst re-run twice, producing 50/50 `200`s both times with zero exceptions.

## Decision

`DbContext` and repositories are registered `Scoped`. The captive-dependency failure mode was deliberately reproduced and observed exactly once, as a narrow, immediately-reverted exception for the FR-9 postmortem artifact — not a standing exception to the Scoped rule. Post-review, `ValidateScopes`/`ValidateOnBuild` were also enabled outside Development, so this class of misregistration now fails fast at startup in any environment going forward. (This guardrail addition amends the original Story 1.5 registration fix — it was not part of the initial revert-to-`AddScoped` commit.)

## Alternatives

- **Leave AD-4 as an untested written rule.** This was the default before Story 1.5 — the rule existed on paper with no evidence it had ever actually been violated or that violating it produces an observable failure. Rejected because FR-9's postmortem needed real, log-verified evidence (a genuine captive-dependency incident with a correlation ID and stack trace), not a hand-written hypothetical — a fabricated incident would be far less credible as interview or portfolio material.
- **Rely on code-review discipline alone to prevent a regression.** Considered insufficient on its own; the `ValidateScopes`/`ValidateOnBuild` guardrail was added specifically because review discipline is not a mechanical safeguard.

## Consequences

- The project now has real, verifiable evidence of a captive-dependency failure (48/50 requests failing with a full EF Core stack trace and correlation IDs) rather than a hypothetical description — directly usable for FR-9's postmortem and as a concrete "what happens if you get DI lifetimes wrong" teaching example.
- The `ValidateScopes`/`ValidateOnBuild` guardrail now catches this specific misregistration at build/startup time outside Development too, closing the gap that let the bug run silently under load in the first place.
- The guardrail is not a complete safety net: [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) notes there is still no automated regression test or DI-container lifetime assertion in the solution (no test project asserts `IProductRepository` stays Scoped), so a future revert of `Program.cs` without running the app at all would not be caught automatically — only by `ValidateOnBuild` firing the next time someone actually starts the app outside Development, or by a human reviewing the diff. No tracked ticket exists beyond that log entry.
- Reproducing the bug required deliberately lowering a safety rail (bypassing Development's eager scope validation) to let the race condition actually occur — an intentional, bounded risk taken only because it was limited to a single local repro run and reverted immediately afterward.
