# ADR-005: Category Deletion Returns 409 Conflict, No Cascade Delete

Status: Accepted
Date: 2026-08-18 (Story 1.1-1.2) · Deciders: Prasadmallavalli
Related: [ADR-001](001-repository-and-unit-of-work.md) (same unhandled-500 gap in Consequences, from the opposite direction)

## Context

The PRD's [addendum](../../_bmad-output/planning-artifacts/prds/prd-ASPFullStackBMAD-2026-08-18/addendum.md) left FR-1's cascade behavior explicitly open: "not yet decided whether `Category` deletion with existing `Product` rows cascades or is rejected with a `409`/`400`... the architecture pass should pick one and record the reasoning as an ADR." Story 1.1 configured the Category→Product foreign key with `DeleteBehavior.Restrict` (no cascade at the database level). Story 1.2 built `CategoryService.DeleteAsync` to explicitly call `HasProductsAsync` before attempting a delete, returning `409 Conflict` when Products still reference the Category — the spec's Boundaries & Constraints are explicit that this must be an up-front check, "never relies on catching the DB's FK-restrict error."

## Decision

Deleting a `Category` that still has `Product` rows returns `409 Conflict` from an explicit `HasProductsAsync` check in `CategoryService`, before any delete is attempted. The database FK also enforces `DeleteBehavior.Restrict` as a second line of defense. No cascade delete exists anywhere in the system.

## Alternatives

- **Cascade delete** (deleting a Category also deletes its Products). Rejected as a silent-data-loss risk — the API layer has no confirmation step, so a single `DELETE /api/categories/{id}` call could wipe out an unbounded number of Products with no warning.
- **Rely on the database's FK-restrict error** (attempt the delete, catch the resulting exception, translate it to 409). Rejected in favor of the explicit pre-check, partly because it reads more clearly as an intentional business rule, and partly because AD-2 forbids `Application` from depending on EF Core types — `DbUpdateException` lives in `Microsoft.EntityFrameworkCore`, so `CategoryService` structurally cannot catch it without breaking the layering rule this project otherwise holds to.

## Consequences

- No silent data loss: a Category with Products can never be deleted by accident, and the 409 response is deterministic and easy to test.
- The explicit-check approach has a genuine, documented gap: [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) logs a check-then-act race where `HasProductsAsync` can pass, then a Product insert lands before the delete's `SaveChangesAsync` commits — the database's `Restrict` FK still prevents the row from actually being deleted, but the request surfaces as an unhandled `500` instead of a clean `409` in that narrow window. The "correct" fix (a Domain-level exception type that Infrastructure translates the caught EF exception into) was identified during review but not built — it's a small design decision outside the story's approved scope, so the gap remains open today with no tracked ticket beyond that log entry.
- There is no partial-cascade option (e.g. reassigning orphaned Products to an "Uncategorized" category) — the only two states are "delete is allowed" or "delete is rejected outright," which is a real product-scope simplification, not just an implementation detail.
