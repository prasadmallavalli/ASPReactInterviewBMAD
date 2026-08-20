---
title: 'Architecture Decision Records'
type: 'chore'
created: '2026-08-20'
status: 'done'
route: 'one-shot'
baseline_commit: '910ae34115591276029f499a66b77df8b0a1403e'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

# Architecture Decision Records

## Intent

**Problem:** Epics 1-3 made real architectural decisions (repository/UoW pattern, manual DTO mapping, httpOnly cookie token storage, Data Annotations validation, no-cascade category delete, Scoped DI lifetimes) with no durable record of the alternatives considered or the tradeoffs accepted — undermining their defensibility in a tech-lead interview.

**Approach:** Write 6 ADRs in `/docs/adr/` (Context/Decision/Alternatives/Consequences shape, reusing the ADR-002/ADR-003 numbers already earmarked in the architecture spine/PRD addendum), each naming at least one real rejected alternative and stating its tradeoff honestly, including where the chosen pattern is arguably redundant at this project's scale. Reviewed via blind-hunter; 11 of 13 findings patched in place, 2 deferred as out-of-scope-for-this-story follow-ups.

## Suggested Review Order

**Cross-cutting fixes from the blind-hunter review**

- README gained a Status column, a contribution note, and dated/attributed the decision set.
  [`README.md:5`](../../docs/adr/README.md#L5)

- Every ADR gained a `Date`/`Deciders` line and linked source-document paths instead of bare filenames.
  [`001-repository-and-unit-of-work.md:3`](../../docs/adr/001-repository-and-unit-of-work.md#L3)

**Structural fix: Alternatives vs. Consequences**

- Self-critique bullets that were mislabeled as "alternatives" moved into Consequences under a `Known limitation` framing — ADR-002, ADR-003, ADR-004 all had this.
  [`002-manual-dto-mapping.md:16`](../../docs/adr/002-manual-dto-mapping.md#L16)

- ADR-001's first alternative (inject `AppDbContext` directly) gained an explicit "Rejected anyway, because..." close — it previously trailed off without a stated rejection.
  [`001-repository-and-unit-of-work.md:15`](../../docs/adr/001-repository-and-unit-of-work.md#L15)

**Cross-linking the shared check-then-act gap**

- ADR-001 and ADR-005 both document the same Category-delete race from opposite ends (repository abstraction vs. the delete flow itself); added a `Related` line on each pointing at the other.
  [`001-repository-and-unit-of-work.md:5`](../../docs/adr/001-repository-and-unit-of-work.md#L5)
  [`005-category-delete-conflict-no-cascade.md:5`](../../docs/adr/005-category-delete-conflict-no-cascade.md#L5)

**ADR-006 readability**

- Context split from one dense paragraph into a short timeline (setup → repro → failure → fix); `Scoped`-the-DI-term vs. "scoped"-the-adjective ambiguity reworded to avoid collision; added an amendment note for the post-review `ValidateScopes`/`ValidateOnBuild` addition.
  [`006-scoped-di-lifetimes.md:7`](../../docs/adr/006-scoped-di-lifetimes.md#L7)

**Deferred, not fixed here**

- A 7th ADR for Story 2.3's CSRF/anti-forgery mechanism, and restructuring every ADR's buried open-issue prose into a scannable "Known Issues" list — both logged to `deferred-work.md` as out of this story's approved 4-6-ADR scope.
  [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md)
