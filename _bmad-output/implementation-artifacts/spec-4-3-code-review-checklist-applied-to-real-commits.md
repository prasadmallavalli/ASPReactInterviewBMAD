---
title: 'Code Review Checklist Applied to Real Commits'
type: 'chore'
created: '2026-08-20'
status: 'done'
route: 'one-shot'
baseline_commit: '27fd863408d9fe56f7a788ad3ed5443bab2663ff'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

# Code Review Checklist Applied to Real Commits

## Intent

**Problem:** This project has run real, sourced code reviews for every story (deferred-work.md's ~90 entries prove it), but the reusable *pattern* behind those reviews was never distilled into a standalone checklist a reviewer could apply to a future diff without re-deriving it from scratch.

**Approach:** Write a 15-item checklist in `/docs/review/code-review-checklist.md`, each item traceable to a real architectural decision (AD-2/3/4/8) or a real bug/gap this project actually hit, then apply 11 of the 15 retroactively against real commits — citing the actual code, the actual gap (open or fixed), and an example review comment as if left on that commit. Reviewed via blind-hunter; all 11 findings patched (0 deferred, 0 rejected), including a fabricated code comment the review caught and I removed.

## Suggested Review Order

**The checklist itself**

- 15 items grouped into four categories (Architecture & Layering, Data Integrity & Concurrency, Security & Validation, Testing & Frontend Resilience), each phrased as a specific question tied to this codebase's real AD numbers and patterns, not generic advice.
  [`code-review-checklist.md:13`](../../docs/review/code-review-checklist.md#L13)

- Usage guidance added after the review flagged its absence: blocking vs. strong-should tiers, and how a finding routes to `deferred-work.md`.
  [`code-review-checklist.md:11`](../../docs/review/code-review-checklist.md#L11)

**The canonical example, tying 4.1/4.3/4.4 together**

- Item 3 (DI lifetime) applies the Story 1.5 captive-dependency bug already documented in ADR-006 — flagged explicitly as the basis for Epic 5's future SBI feedback-framework example.
  [`code-review-checklist.md:44`](../../docs/review/code-review-checklist.md#L44)

**Fact-correction from the blind-hunter pass**

- Item 5's citation was off by 8 lines from the real file, and Item 9's quoted code included a `// fast path` comment that doesn't exist in `UserService.cs` — both corrected to verbatim, line-accurate excerpts.
  [`code-review-checklist.md:52`](../../docs/review/code-review-checklist.md#L52)
  [`code-review-checklist.md:96`](../../docs/review/code-review-checklist.md#L96)

**Findings added after the review** (using evidence already sourced in `deferred-work.md`, re-verified live in the current tree)

- Items 6, 10, 11, 13, 14 — five more worked examples, including Item 10's full remediation trail (the credential-rotation and history-scrub commits) and Item 13's still-open `ProductList.tsx` gap, re-confirmed absent from the current 15-test suite while writing this.
  [`code-review-checklist.md:69`](../../docs/review/code-review-checklist.md#L69)
  [`code-review-checklist.md:113`](../../docs/review/code-review-checklist.md#L113)
  [`code-review-checklist.md:137`](../../docs/review/code-review-checklist.md#L137)

**Honest gaps, not papered over**

- Items 1, 2, 4, and 8 have no worked example — no real violation of them exists in this codebase to point at, and the doc says so directly rather than forcing a contrived one.
  [`code-review-checklist.md:173`](../../docs/review/code-review-checklist.md#L173)
