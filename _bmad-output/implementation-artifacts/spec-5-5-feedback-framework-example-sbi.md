---
title: 'Feedback Framework Example: SBI (Situation-Behavior-Impact)'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: '7b7751a0234e68e10d6aba7899a1062d4342a56b'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
---

# Feedback Framework Example: SBI (Situation-Behavior-Impact)

## Intent

**Problem:** FR-11 requires an SBI feedback example grounded in a real Story 4.3 checklist finding, not a hypothetical — and per Epic 5's own cross-story guidance, it needs to be a genuinely distinct artifact from Story 5.1's postmortem (person-facing feedback conversation, not another systems-facing write-up of the same bug), which is easy to get wrong by accident.

**Approach:** Write `docs/eng-mgmt/sbi-feedback-example.md` as a worked SBI conversation script grounded in the same Story 1.5 DI bug the checklist's Item 3 and the postmortem already document, reusing its real numbers (48/50, 96%) rather than re-deriving them, with an explicit "why this doesn't duplicate the postmortem" section. Reviewed via blind-hunter, which evaluated both technical accuracy and whether this actually models good feedback delivery for an EM audience (not just a technically-correct document); all 16 findings patched (0 deferred, 0 rejected) via a substantial rewrite — a real factual error (implying a PR exists when the bug predates git init), an Impact section that claimed rigor it didn't deliver, and a long list of real gaps in what "good feedback delivery" requires that the first draft's script-only approach skipped entirely (no stated power dynamic, no consent-decline branch, no worked example of what happens after the pause, no disagreement handling, no closing-the-loop step).

## Suggested Review Order

**The real factual error**

- The Situation line originally implied a findable PR exists for this finding — ADR-006 and the checklist's own Item 3 are explicit that the bug and fix predate `git init`, with no commit pair to point to. Corrected to reference the saved reproduction log directly, and added a link to that primary source (missing from the first draft, unlike every sibling document).
  [`sbi-feedback-example.md:5`](../../docs/eng-mgmt/sbi-feedback-example.md#L5)

**The Impact section's rigor gap**

- Originally claimed to be "the concrete, measured consequence, not a hypothetical" and then delivered an unlabeled hypothetical extrapolation anyway. Rewritten to explicitly separate the measured fact (48/50, 96%) from the judgment-call extrapolation, naming the difference out loud in the script itself.
  [`sbi-feedback-example.md:39`](../../docs/eng-mgmt/sbi-feedback-example.md#L39)

**What "good feedback delivery" actually requires — the parts a script-only draft skipped**

- Added a stated relationship/power dynamic, venue choice, and explicit sequencing relative to the postmortem — none of which existed in the first draft, all of which materially change how SBI should be delivered.
  [`sbi-feedback-example.md:15`](../../docs/eng-mgmt/sbi-feedback-example.md#L15)
- Added a consent-decline branch in the opening, at least one fully worked coaching branch after the "pause and listen" beat (the first draft named three possible responses but demonstrated none of them), a disagreement/pushback scenario, and a closing-the-loop follow-up step — the conversation no longer just stops at an open question with no resolution.
  [`sbi-feedback-example.md:29`](../../docs/eng-mgmt/sbi-feedback-example.md#L29)
  [`sbi-feedback-example.md:47`](../../docs/eng-mgmt/sbi-feedback-example.md#L47)
  [`sbi-feedback-example.md:51`](../../docs/eng-mgmt/sbi-feedback-example.md#L51)
  [`sbi-feedback-example.md:57`](../../docs/eng-mgmt/sbi-feedback-example.md#L57)

**Framework literacy for an unfamiliar reader**

- Added a compact abstract definition of Situation/Behavior/Impact with the framework's origin — the first draft only showed one worked instance, forcing a reader to reverse-engineer the general shape.
  [`sbi-feedback-example.md:9`](../../docs/eng-mgmt/sbi-feedback-example.md#L9)
