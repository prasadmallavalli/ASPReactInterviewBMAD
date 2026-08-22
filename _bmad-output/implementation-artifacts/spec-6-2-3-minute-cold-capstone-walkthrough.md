---
title: '3-Minute Cold Capstone Walkthrough'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: 'f526b09354ab2b958a1559fff4d5206a3fcbf317'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md']
---

# 3-Minute Cold Capstone Walkthrough

## Intent

**Problem:** FR-13 requires a ~3-minute cold, from-memory walkthrough covering the project end-to-end — but no document existed distilling six epics of work into a single continuous spoken narrative an interviewer could hear as an opener.

**Approach:** Write `docs/interview/capstone-3-minute.md` as one continuous spoken narrative (hook, technical spine, signature bug, artifact layer, close), word-counted against 145 wpm for the timing requirement. Reviewed via blind-hunter, which specifically checked genuine end-to-end coverage (not skew toward one part) and independently re-verified the claimed word count; found 13 issues, most significantly that the first draft devoted 36% of its words to the DI bug alone while the actual application got one 50-word sentence, and silently omitted the design doc, the estimation note, testing, correlation-ID logging, and the frontend resilience pattern entirely. Rewrote with the bug trimmed to a compact teaser (pointing to the STAR story for depth) and the reclaimed words spent on the omitted coverage — now balanced at 19/31/23/22/6% across the five paragraphs, verified programmatically. All 13 findings patched, 0 deferred, 0 rejected.

## Suggested Review Order

**The coverage-balance problem and its fix**

- The first draft's per-paragraph word counts (74/50/148/116/28) show the DI bug consuming 36% of the piece while the application itself got one sentence — a real violation of the AC's "end-to-end" requirement, not just a style preference. Rewritten and re-verified at 19/31/23/22% — no section dominates.
  [`capstone-3-minute.md:21`](../../docs/interview/capstone-3-minute.md#L21)

**Real coverage gaps closed**

- Testing, correlation-ID logging, and the frontend's stale-response guard pattern (checklist Item 12, "the checklist working as intended") were entirely absent from the first draft — added to the technical-spine paragraph with enough specificity to survive a follow-up question.
  [`capstone-3-minute.md:11`](../../docs/interview/capstone-3-minute.md#L11)
- The design doc (Story 4.2) and the estimation-calibration note (Story 5.3) were silently missing from the artifact-layer paragraph, which claimed to enumerate "the layer a tech lead or EM actually produces" but didn't. Both added.
  [`capstone-3-minute.md:15`](../../docs/interview/capstone-3-minute.md#L15)

**Prose and timing fixes**

- Two verb-less sentence fragments ("A fifteen-item code review checklist applied against my own real commits. A mentoring note.") rewritten into one continuous, speakable enumeration — the first draft's likeliest spot for a cold delivery to stall.
  [`capstone-3-minute.md:15`](../../docs/interview/capstone-3-minute.md#L15)
- The claimed timing margin was thinner than described (8 seconds under 3 minutes, called "modest") — the rewrite's trim gives real margin (2.49 min, verified, not the first draft's 2.87 min), and the verification section now discloses the first draft's actual numbers rather than only the final ones.
  [`capstone-3-minute.md:19`](../../docs/interview/capstone-3-minute.md#L19)

**Sibling cross-referencing, absent from the first draft**

- The close now explicitly signals that STAR stories and a 30-minute deep-dive exist behind this walkthrough — the STAR stories doc already cross-references this capstone; the first draft didn't reciprocate.
  [`capstone-3-minute.md:17`](../../docs/interview/capstone-3-minute.md#L17)
