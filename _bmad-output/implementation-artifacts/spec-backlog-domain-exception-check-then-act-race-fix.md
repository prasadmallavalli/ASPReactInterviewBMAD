---
title: 'Domain-Level Exception Type for Check-Then-Act Races + DI-Lifetime Regression Test'
type: 'backlog'
created: '2026-08-22'
status: 'backlog'
review_loop_iteration: 0
baseline_commit: ''
context: []
---

## Why this exists

Not a frozen, dev-ready spec -- an unscheduled backlog story, created per the [Epic 4 retrospective](epic-4-retro-2026-08-22.md)'s action item (`epic-4-retro-item-13`): "Neither the check-then-act race ... nor the missing DI-lifetime regression test has an owning story anywhere, despite six independent 'no tracked ticket' callouts across Epic 4's own documentation." This file is that ticket. It does not commit to a timeline or scope beyond what's written below; a future session should treat this as a starting point to renegotiate into a real frozen spec before building against it.

## Problem

Two real, still-open gaps have each been independently identified and logged by name six times across this project's own documentation (ADR-001, ADR-004, ADR-005, the code review checklist, the post-MVP roadmap, and `deferred-work.md`), with every single mention ending in some version of "not built, no tracked ticket" -- until now, nothing ever converted that honesty into an actual piece of backlog work.

**1. Check-then-act races surface as raw 500s instead of clean 409/400s**, in three independently-discovered locations, all the same root cause:

- `CategoryService.DeleteAsync` (`src/Application/Services/CategoryService.cs:68-74`) -- `HasProductsAsync` can pass, then a `Product` insert lands before the delete's `SaveChangesAsync` commits. The DB's `DeleteBehavior.Restrict` FK still prevents the row from actually being deleted, but the request surfaces as an unhandled 500 instead of a clean 409.
- `ProductService.CreateAsync`/`UpdateAsync` -- the `CategoryId` existence check can pass, then the referenced `Category` is deleted before `SaveChangesAsync` commits, surfacing as an unhandled `DbUpdateException` (500) instead of a clean 400.
- `UserService.RegisterAsync` -- two concurrent registrations for the same email can both pass the `GetByEmailAsync` existence check; the losing `SaveChangesAsync` throws an unhandled 500 instead of a clean 409. The DB-level unique index still prevents a duplicate from ever physically landing.

Every one of these was deliberately left open at the time because catching `DbUpdateException` in an Application-layer service would require `Application` to depend on `Microsoft.EntityFrameworkCore`, which [AD-2](../planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md) forbids. The identified fix in every write-up is the same: a Domain-level exception type that `Infrastructure` catches the EF exception and translates into, which `Application`/`Api` can then catch without ever referencing EF Core types.

**2. No automated regression test guards the Story 1.5 DI-lifetime misregistration class.** Story 1.5 deliberately reproduced `IProductRepository` registered `AddSingleton` instead of `AddScoped`, observed 48/50 concurrent requests fail, and fixed it. Post-review, `ValidateScopes`/`ValidateOnBuild` were enabled outside Development too, so this class of misregistration now fails fast at startup in any environment -- but nothing in the automated test suite asserts that guardrail actually fires. `deferred-work.md`'s Story 1.5 section and ADR-006's Consequences both name this as still open.

## Evidence (all six "no tracked ticket" callouts)

- [ADR-001](../../docs/adr/001-repository-and-unit-of-work.md) Consequences -- names all three races, cites `deferred-work.md`.
- [ADR-005](../../docs/adr/005-category-delete-conflict-no-cascade.md) Consequences -- the Category delete race specifically, "no tracked ticket beyond that log entry."
- [Code review checklist](../../docs/review/code-review-checklist.md), Item 5 -- the Category delete race with the exact `CategoryService.cs:68-74` excerpt.
- [Post-MVP roadmap](../../docs/eng-mgmt/post-mvp-roadmap.md) -- "closing the check-then-act races (checklist Item 5 -- three still-open instances)."
- `deferred-work.md` -- three separate entries (Story 1.2, Story 1.3, Story 2.1 sections) for the Category, Product, and User races respectively, plus the Story 1.5 DI-lifetime entry.
- [Epic 4 retrospective](epic-4-retro-2026-08-22.md) -- the cross-document consistency finding that surfaced all of the above being logged six times with zero owners.

## Proposed scope (not yet approved -- a starting point for renegotiation)

**Domain-level exception type:**
- A new exception type in `Domain` (e.g. `ConcurrentModificationException` or similar -- naming is an open design decision) that `Infrastructure`'s repository/unit-of-work implementations throw when a `DbUpdateException` is caught wrapping a constraint violation (FK `Restrict` block, unique-index violation).
- `Infrastructure` catches the EF-specific exception and translates it -- `Application` and `Api` only ever see the Domain type, preserving AD-2's "Application never depends on EF Core" boundary.
- Each of the three call sites (`CategoryService.DeleteAsync`, `ProductService.CreateAsync`/`UpdateAsync`, `UserService.RegisterAsync`) catches the Domain exception and maps it to the same clean 409/400 `ProblemDetails` response its happy-path check-then-act already produces today -- closing the race window rather than changing the API contract.

**DI-lifetime regression test:**
- An automated test (likely an integration test booting the real `WebApplicationFactory<Program>`, or a smaller DI-container-only test) that deliberately misregisters a `Scoped` service as `Singleton` and asserts `ValidateOnBuild` throws at startup -- proving the guardrail Story 1.5's fix put in place actually fires, rather than only being verified once by hand during that story's original reproduction.

## Out of scope (per the original deferrals this consolidates)

- Adding a concurrency token / optimistic concurrency to close the race at the data-model level -- a schema change with no FR/NFR currently requiring it for this single-developer local project (per the original Category-delete deferral).
- Any change to the public API contract of the three affected endpoints -- the fix should make the *already-intended* 409/400 responses reliable under the race window, not introduce new response shapes.

## Suggested acceptance criteria (draft, for whoever renegotiates this into a frozen spec)

- Given the Category-delete race window (a Product insert lands between the `HasProductsAsync` check and the delete's commit), the request returns a clean 409, not a 500.
- Given the Product create/update race window (the referenced Category is deleted mid-request), the request returns a clean 400, not a 500.
- Given the registration race window (two concurrent registrations for the same email), the losing request returns a clean 409, not a 500.
- Given a service deliberately misregistered with the Story 1.5 misregistration class (Scoped dependency behind a Singleton registration), an automated test demonstrates `ValidateOnBuild` rejects it at startup.
