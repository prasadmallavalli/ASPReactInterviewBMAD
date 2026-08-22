---
title: 'Estimation Calibration Note'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: 'bbca11f9e863036418b0d151011b89f39fd965d7'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
---

# Estimation Calibration Note

## Intent

**Problem:** FR-10 requires an estimation-calibration note naming at least one session where actual time diverged from planned and why — but no document compares this build's real delivery against the real planned baseline that already existed (the brief addendum's 18-session, ~40-46h plan, written before Epics 1-5 were built).

**Approach:** Write `docs/eng-mgmt/estimation-calibration-note.md` comparing the addendum's planned sessions against real git commit timestamps, with four concrete divergence examples (an unrecoverable timestamp gap from late `git init`, an unplanned login-form dependency, two "planned as one session, delivered as two independently-reviewed stories" cases) — explicit throughout that literal hour-for-hour comparison breaks down for AI-assisted work, and honest that every comparable example skews the same direction (more review cycles than planned) rather than forcing a false balanced record. Reviewed via blind-hunter; 11 of 12 findings patched (table rows misattributing a starting commit's content as "landed during" the span, two omitted commits, an imprecise percentage, an overstated "hands-on typing" framing, missing coverage of two comparable session-groups with real data, an unmarked quote elision, uncited finding counts, no total-vs-plan comparison, no acknowledgment that all examples are one-sided, no consolidated takeaway), 1 rejected (author-name formatting, kept consistent with the rest of the doc corpus).

## Suggested Review Order

**The core honesty move: naming where the comparison itself breaks down**

- The opening section states plainly that "planned hours" and "actual hours" aren't measuring the same thing for AI-assisted work, and that the addendum's own ask (a session-by-session pass) doesn't map onto a story/commit-based delivery record — added a second paragraph after review flagged this granularity gap wasn't acknowledged.
  [`estimation-calibration-note.md:9`](../../docs/eng-mgmt/estimation-calibration-note.md#L9)
  [`estimation-calibration-note.md:11`](../../docs/eng-mgmt/estimation-calibration-note.md#L11)

**The four examples, one added after review**

- Example 4 (Session 11's split, and the 9-minute Story 5.1 commit gap) is new — added because the review found two comparable session-groups (Epic 4, the postmortem) had real timestamped data that went unused in the first draft.
  [`estimation-calibration-note.md:23`](../../docs/eng-mgmt/estimation-calibration-note.md#L23)

**Table accuracy fixes**

- Fixed two rows that attributed a starting commit's own content to "landed during" the following span (Story 3.4, Epic 4 retro), and restored two commits (`48c9b34`, `488bb4c`) the first draft's table silently dropped from a span they actually occurred in.
  [`estimation-calibration-note.md:31`](../../docs/eng-mgmt/estimation-calibration-note.md#L31)
  [`estimation-calibration-note.md:34`](../../docs/eng-mgmt/estimation-calibration-note.md#L34)

**Honesty about the one-sidedness of the record**

- The closing Takeaway section states directly that every example skews toward more-cycles-than-planned, and treats that as a directional signal rather than manufacturing a false "sometimes under, sometimes over" balance to look more calibrated than the evidence supports.
  [`estimation-calibration-note.md:44`](../../docs/eng-mgmt/estimation-calibration-note.md#L44)
