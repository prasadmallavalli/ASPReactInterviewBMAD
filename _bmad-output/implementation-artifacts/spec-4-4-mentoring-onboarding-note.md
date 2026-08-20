---
title: 'Onboarding Note: Welcome to ASPFullStackBMAD'
type: 'chore'
created: '2026-08-20'
status: 'done'
route: 'one-shot'
baseline_commit: '71c09f9468866a918646d235ecf086752cb1a3be'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

# Onboarding Note: Welcome to ASPFullStackBMAD

## Intent

**Problem:** A mid-level engineer joining this codebase would have to independently re-derive why it's shaped the way it is (Repository/UoW, manual mapping, service-per-entity) and rediscover the same gotchas this project already hit once (the DI captive-dependency bug foremost among them) — there's no single mentoring-style document that does that walkthrough.

**Approach:** Write `docs/onboarding/mentoring-note.md` in a genuine mentor-to-mid-level-engineer voice: why the SOLID/pattern choices look the way they do (honestly, including where they're arguably more ceremony than needed), then "things to watch out for" with the Story 1.5 DI bug listed first — consistent in its numbers (48/50, 50/50) with ADR-006 and the code review checklist's Item 3. Reviewed via blind-hunter; all 12 findings patched (0 deferred, 0 rejected), including an overstated claim that three components share one stale-response-guard mechanism when only one actually does.

## Suggested Review Order

**The DI bug, kept consistent across 4.1/4.3/4.4**

- Item 1 leads "Things to watch out for," per the epic's requirement, and cites the same 48/50 → 50/50 numbers as ADR-006 and the checklist's Item 3 — plus a review-added pointer to ADR-006's own still-open "no regression test" gap as a plausible first task.
  [`mentoring-note.md:33`](../../docs/onboarding/mentoring-note.md#L33)

**The corrected overclaim**

- The stale-response-guard item originally claimed `ProductList`, `AuthContext`, and `ProductForm` all use the same `requestIdRef` pattern — only `ProductList` does. Corrected to name each component's actual guard shape, and to flag `AuthContext`'s real, narrow, currently-unguarded race.
  [`mentoring-note.md:43`](../../docs/onboarding/mentoring-note.md#L43)

**SOLID, framed honestly**

- Dependency Inversion and Interface Segregation are named as the two principles actually load-bearing here; Open/Closed and Liskov are named as not exercised, rather than forcing a fit.
  [`mentoring-note.md:29`](../../docs/onboarding/mentoring-note.md#L29)

**Review-added: things a new engineer needs on day one that weren't in the first draft**

- The secrets-in-git-history incident (real credential committed, later rotated and scrubbed via `git-filter-repo`), the repo's unusual commit-granularity quirk, and a Getting Started section with verified real commands — none of this was in the original draft.
  [`mentoring-note.md:9`](../../docs/onboarding/mentoring-note.md#L9)
  [`mentoring-note.md:41`](../../docs/onboarding/mentoring-note.md#L41)

**Cross-references added for consistency with the other Epic 4 artifacts**

- ADR-005/ADR-004 links added where the check-then-act and validation gotchas were previously cited without pointing at their ADRs; ADR-003 corrected to admit the CSRF mechanism itself still has no ADR.
  [`mentoring-note.md:35`](../../docs/onboarding/mentoring-note.md#L35)
  [`mentoring-note.md:39`](../../docs/onboarding/mentoring-note.md#L39)
