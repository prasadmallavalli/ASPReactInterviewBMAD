---
title: 'Hiring-Loop Question Set'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: 'e9feac0f34e9d941db55b3e0a3e8de95784e01ed'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
---

# Hiring-Loop Question Set

## Intent

**Problem:** FR-11 requires 5-8 hiring-loop questions, each referencing a specific artifact or code decision from Epics 1-4, not generic trivia — but no document existed distilling this project's real, already-reviewed decisions into judgment-testing interview questions a hiring team could actually run.

**Approach:** Write `docs/eng-mgmt/hiring-question-set.md` with 8 questions spanning backend architecture, security, validation, DI lifetimes, and frontend resilience patterns, each built from a real artifact (an ADR, a checklist item, actual code) with a "what a strong answer covers" signal list and a follow-up for shallow answers. Reviewed via blind-hunter; all 11 findings patched (0 deferred, 0 rejected) — a broken cross-doc link, a misattributed quote, an Epic-5 citation blurring the Epic 1-4 scope requirement, an overclaimed "chosen" pagination decision that's actually an unimplemented proposal (resolved by swapping that question for a stronger, fully-shipped one), and fabricated remediation specifics not documented anywhere in the source material.

## Suggested Review Order

**The two real accuracy issues (fabrication risk)**

- Question 8 originally invented specific remediation details (`--all` verification search, `--force-with-lease`) that no source document actually states — corrected to only the documented facts, and re-verified the follow-up's "no pre-commit hook or secret scanner exists" claim directly against the repo before keeping it.
  [`hiring-question-set.md:81`](../../docs/eng-mgmt/hiring-question-set.md#L81)
- Question 1's citation attributed a quote to ADR-001's Alternatives section that actually lives in the mentoring note (a paraphrase of ADR-001, not ADR-001 itself) — corrected to cite each phrase to its real source and section.
  [`hiring-question-set.md:11`](../../docs/eng-mgmt/hiring-question-set.md#L11)

**The question swap**

- Question 6 originally asked about a keyset-pagination "decision" that the design doc's own header marks "Proposed (not implemented)" — no pagination of any kind exists in the running code. Replaced with a question on ADR-002 (manual DTO mapping vs. AutoMapper), a fully-shipped decision, which also closes a coverage gap the review separately flagged (no DTO-mapping question existed at all).
  [`hiring-question-set.md:59`](../../docs/eng-mgmt/hiring-question-set.md#L59)

**Scope discipline**

- Question 5 originally cited the Story 5.1 postmortem alongside ADR-006 — but Story 5.1 is Epic 5, the same epic this question set itself belongs to, blurring the AC's "Epics 1-4" requirement. Narrowed to cite only ADR-006.
  [`hiring-question-set.md:51`](../../docs/eng-mgmt/hiring-question-set.md#L51)

**Structural additions (usability as an actual loop)**

- Added a "How to use these in a loop" intro paragraph (round grouping, time budget, why answers are signals not scripts), a role/level tag per question, and a "Follow-up if shallow" line per question — none of this existed in the first draft.
  [`hiring-question-set.md:7`](../../docs/eng-mgmt/hiring-question-set.md#L7)
- Added a closing note naming two real, sourced checklist items (11, 14) deliberately left out only because eight questions is the set's own limit.
  [`hiring-question-set.md:89`](../../docs/eng-mgmt/hiring-question-set.md#L89)
