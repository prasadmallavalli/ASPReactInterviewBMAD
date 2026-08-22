# Epic 6 Context: Interview Narrative Package

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Package the Tech Lead artifacts (Epic 4: ADRs, design doc, review checklist, mentoring note) and Engineering Manager artifacts (Epic 5: postmortem, roadmap, estimation note, hiring question set, SBI feedback example) into material that can be delivered live, under interview conditions, entirely from memory — no notes, no re-reading source docs mid-interview. This is a packaging/rehearsal epic, not a new-artifact epic: everything it produces must trace back to a specific Epic 4/5 artifact rather than being invented fresh. The end state is a builder who can open cold with a 3-minute walkthrough, sustain a 30-minute deep-dive under follow-up questioning, and drop in a STAR story on demand for any of the three interview tracks (senior IC / tech lead / EM).

## Stories

- Story 6.1: STAR Stories
- Story 6.2: 3-Minute Cold Capstone Walkthrough
- Story 6.3: 30-Minute Deep-Dive & Anticipated Follow-Ups

## Requirements & Constraints

- 3-4 STAR-format stories (Situation/Task/Action/Result), each traceable to one specific Epic 4 or 5 artifact — candidate sources: a tradeoff decision (ADR), the bug/postmortem, a stakeholder-communication moment (roadmap scope-cut conversation), a mentoring moment (onboarding note). Each story must be deliverable verbally in under 2 minutes without notes.
- A 3-minute cold capstone walkthrough covering the project end-to-end, deliverable from memory with no notes.
- An extended 30-minute deep-dive version that can sustain the full duration without breaking down, plus 8-10 anticipated follow-up questions (roughly one per Epic 4/5 artifact) with prepared answers.
- The follow-up question set must include at least one question per interview track: technical/senior-IC, tech lead, and EM.
- Success is measured by delivery fluency, not artifact volume: producing more STAR stories or follow-up questions than needed, at the cost of traceability or fluency, counts as a regression — stay within the 3-4 story / 8-10 question ranges.
- Traceability is the binding constraint across this whole epic: every narrative element must point to a real, specific event or decision already documented in Epics 4-5, not a hypothetical or generic answer.
- The Epic 1 test suite must be green (`dotnet test`) before the capstone is considered complete.
- Framing discipline carries over from Epic 5: EM-track material (postmortem, roadmap, hiring set, SBI example) must be presented as demonstrative, not real production/management history, when it surfaces in these narratives.

## Technical Decisions

Not applicable — this epic produces narrative/rehearsal artifacts (documents and spoken content), not code. No architecture spine invariants apply directly to Epic 6.

## Cross-Story Dependencies

- Story 6.1 (STAR stories) draws directly on Epic 4/5 artifacts and should generally be done first, since Stories 6.2 and 6.3 reuse the same source material and benefit from the STAR extraction already being done.
- Story 6.3's follow-up question set is meant to cover one question per Epic 4/5 artifact — it depends on all of Epic 4 and Epic 5 being complete first.
- The single most load-bearing source event across this whole epic is the Story 1.5 deliberate DI captive-dependency bug: it underlies ADR-006 (Epic 4), the code review checklist's DI-lifetime item (Epic 4), the blameless postmortem (Epic 5), a hiring question (Epic 5), and the SBI feedback example (Epic 5). It is a strong, well-supported default choice for the "bug you found and fixed" STAR story in 6.1 and for the technical-track follow-up question in 6.3.
