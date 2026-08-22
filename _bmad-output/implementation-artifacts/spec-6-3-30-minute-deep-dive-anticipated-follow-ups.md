---
title: '30-Minute Deep-Dive & Anticipated Follow-Ups'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: '534d5449fb07c75cb911ba276fae00a75f886018'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md']
---

# 30-Minute Deep-Dive & Anticipated Follow-Ups

## Intent

**Problem:** FR-13 requires a 30-minute deep-dive that sustains without breaking down, plus 8-10 anticipated follow-up questions (one per Epic 4/5 artifact) spanning all three interview tracks — the final piece of the interview narrative package, and the one with the least room to fake fluency since it's the longest, most interruption-prone format.

**Approach:** Write `docs/interview/deep-dive-30-minute.md` as a time-boxed structure (6 blocks summing to 30 minutes, building on the capstone and STAR stories rather than duplicating them) plus 9 prepared follow-up answers, one per Epic 4/5 artifact (4 Tech Lead + 5 EM), track-tagged. Reviewed via blind-hunter, which fact-checked every answer against its 14 source documents and evaluated whether the 30-minute structure was realistic, not just arithmetically correct; found 13 issues, most significantly a wrong citation (a quote attributed to the roadmap that actually came from the STAR stories doc), an overclaim that all five EM artifacts share the same "demonstrative" framing when only two actually do, and a complete absence of guidance for what happens when six clean time-boxes meet a real conversation that doesn't respect them. All 13 patched, 0 deferred, 0 rejected.

## Suggested Review Order

**The citation error**

- Question 6's answer was introduced as "adapted from the roadmap's own Horizon 3 note," but the quoted sentence is the STAR stories document's own line, not text from the roadmap. Corrected to cite both accurately — the roadmap for the underlying case, the STAR story for the actual sentence.
  [`deep-dive-30-minute.md:47`](../../docs/interview/deep-dive-30-minute.md#L47)

**The framing overclaim**

- The structure table originally claimed all five EM artifacts share "the demonstrative-not-real framing... the same way it's said in every one of those documents" — false: only the postmortem and the SBI example carry that framing in their own source text; the roadmap, estimation note, and hiring set are presented as genuine work product. Corrected to name exactly which two need the caveat.
  [`deep-dive-30-minute.md:19`](../../docs/interview/deep-dive-30-minute.md#L19)

**Making the structure honest about real conversations**

- Added a pacing-check paragraph (six minutes across four-to-five artifacts is under 90 seconds each if split evenly — not the actual plan) with explicit compression guidance, a single-track-interview adaptation note, and an explicit statement that the 9 follow-ups happen *during* the artifact-layer blocks, not as a bolt-on that also has to fit inside 30 minutes — none of which existed in the first draft.
  [`deep-dive-30-minute.md:24`](../../docs/interview/deep-dive-30-minute.md#L24)
  [`deep-dive-30-minute.md:26`](../../docs/interview/deep-dive-30-minute.md#L26)
  [`deep-dive-30-minute.md:9`](../../docs/interview/deep-dive-30-minute.md#L9)

**Consistency and missing preparation**

- Track-tag terminology aligned with the STAR stories document's exact labels (was drifting: "technical/tech-lead" vs. "technical/senior-IC track"). Added delivery-mode/rehearsal guidance, absent from the first draft despite both sibling documents stating theirs explicitly.
  [`deep-dive-30-minute.md:32`](../../docs/interview/deep-dive-30-minute.md#L32)
  [`deep-dive-30-minute.md:5`](../../docs/interview/deep-dive-30-minute.md#L5)
- Added a new "Two questions about the process itself" section for the two most likely adversarial follow-ups this document didn't prepare for at all: whether a human ever reviewed any of this, and whether the flagship bug being deliberately caused undermines it as material.
  [`deep-dive-30-minute.md:59`](../../docs/interview/deep-dive-30-minute.md#L59)
- Question 8 now anticipates the natural next question its own source document invites ("why only eight, when two more real candidates are named as left out").
  [`deep-dive-30-minute.md:53`](../../docs/interview/deep-dive-30-minute.md#L53)
