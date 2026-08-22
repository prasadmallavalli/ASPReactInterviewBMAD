---
title: 'STAR Stories'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: '8333e2aa7a169e34091e69bdd18a403943fb5566'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-6-context.md']
---

# STAR Stories

## Intent

**Problem:** FR-12 requires 3-4 memorizable STAR (Situation/Task/Action/Result) interview stories, each sourced from a specific Epic 4 or 5 artifact and deliverable verbally in under 2 minutes — but no document existed turning this project's real decisions, bugs, and communication moments into spoken-word-ready interview material.

**Approach:** Write `docs/interview/star-stories.md` with 4 stories spanning the epic's own named categories (a tradeoff decision, the postmortem, a stakeholder-communication moment, a mentoring moment) across all three interview tracks. Reviewed via blind-hunter, which specifically evaluated whether the prose was actually speakable and whether the AC's Epic-4/5-sourcing requirement was genuinely met, not just claimed; found 12 issues, most significantly that the original "stakeholder conversation" story was sourced from an Epic 3 artifact — a real AC violation — and that the DI-bug story measured 297 words (2.05 minutes), over the stated cap, once word-counted programmatically instead of guessed. Both fixed: the stakeholder story was replaced with a genuinely Epic-5-sourced one (the roadmap's Horizon 3 sequencing tension), and the DI-bug story was trimmed and re-verified. All 12 findings patched, 0 deferred, 0 rejected.

## Suggested Review Order

**The AC violation and its fix**

- The original story 3 was sourced from `deferred-work.md`'s Story 3.3 entry — Epic 3, not Epic 4 or 5, violating the AC directly. Replaced entirely with a story sourced from the post-MVP roadmap's (Story 5.2) Horizon 3 sequencing note — a genuine Epic 5 artifact with real, quotable content.
  [`star-stories.md:33`](../../docs/interview/star-stories.md#L33)

**The timing claim, actually verified**

- The intro originally asserted "roughly 250-300 spoken words" per story with no measurement behind it; the DI-bug story was actually 297 words (2.05 min) once counted — over the 2-minute cap. Trimmed to 262 words (1.81 min) and re-verified programmatically, with the original over-cap measurement disclosed rather than hidden.
  [`star-stories.md:57`](../../docs/interview/star-stories.md#L57)

**Speakability and honesty fixes**

- The DI-bug story gained the postmortem's mandatory up-front "this wasn't a real outage" disclosure (previously missing entirely) and two prepared fallbacks for likely pushback (severity, and "why exactly 48 not 50").
  [`star-stories.md:25`](../../docs/interview/star-stories.md#L25)
  [`star-stories.md:31`](../../docs/interview/star-stories.md#L31)
- Code-identifier-dense phrasing in the mentoring and DI-bug stories rewritten into language a mouth wouldn't trip over (e.g. "a generic one-size-fits-any-entity interface" instead of naming the C# generic directly).
  [`star-stories.md:53`](../../docs/interview/star-stories.md#L53)

**Delivery scaffolding, absent from the first draft**

- Added a "Cue" line per story (what interview question it answers) and a note connecting this document to Stories 6.2/6.3's shared source material — neither existed before review.
  [`star-stories.md:11`](../../docs/interview/star-stories.md#L11)
  [`star-stories.md:7`](../../docs/interview/star-stories.md#L7)
