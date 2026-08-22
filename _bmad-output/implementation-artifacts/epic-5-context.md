# Epic 5 Context: Engineering Manager Artifacts

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic is documentation-only — it produces no application code. It compiles the artifacts an engineering manager would produce alongside a build: a blameless incident postmortem, a post-MVP roadmap, an estimation-calibration note, a hiring-loop question set, and an SBI feedback example. These are explicitly demonstrative EM-track documents, not a claim of real people-management history — every artifact must still trace to something that actually happened in Epics 1-4 (a real bug, a real decision, a real checklist finding), the same traceability discipline Epic 4 used, so nothing here reads as generic or fabricated in an EM interview.

## Stories

- Story 5.1: Incident Postmortem (Blameless)
- Story 5.2: Post-MVP Roadmap
- Story 5.3: Estimation Calibration Note
- Story 5.4: Hiring Question Set
- Story 5.5: Feedback Framework Example (SBI)

## Requirements & Constraints

- The postmortem is blameless: causes are assigned to systems/process, not people, and the incident is explicitly not a real production outage — it must be framed honestly as a deliberately injected bug when discussed in interviews.
- The postmortem covers timeline, impact (framed as production), root cause, fix, and follow-up actions. At least one follow-up action must trace concretely to a Story 4.3 review-checklist item.
- Each roadmap horizon (2-3 horizons) states a user- or business-facing reason, not just a feature name.
- The estimation note names at least one session where actual time diverged from planned, and why.
- The hiring question set has 5-8 questions; each references a specific artifact or code decision from Epics 1-4, not generic trivia.
- The SBI example is grounded in the actual finding surfaced by Story 4.3's checklist, not a hypothetical.
- EM artifacts overall must be framed as demonstrative — no claim of real team-management experience (per brief's explicit exclusion).
- Downstream (Epic 6): these artifacts, along with Epic 4's, are the source material for STAR stories and the capstone follow-up question set — write them concretely enough to extract a STAR story from later.

## Technical Decisions

- The postmortem's incident is the Story 1.5 DI captive-dependency bug: `IProductRepository` deliberately registered `AddSingleton` while depending on the Scoped `AppDbContext`, causing 48 of 50 concurrent requests to fail with `System.InvalidOperationException` (EF Core's `ConcurrencyDetector` catching context reuse). This is the PRD's default assumption for FR-9 and is already fully documented — reuse it rather than inventing a different incident.
- Primary sources already exist for the postmortem: `docs/adr/006-scoped-di-lifetimes.md` (full account: context, decision, alternatives, consequences) and `_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md` (verbatim log excerpt with correlation IDs and stack traces, for the timeline). Story 1.4's correlation-ID logging is what makes that timeline reconstructable.
- A known gap: the saved log excerpt lacks explicit "Impact"/"Prevention" framing — the postmortem needs to add blast-radius and concrete-guardrail sections itself rather than assuming the source log covers them.
- A concrete, already-shipped follow-up action exists to cite: post-bug, `ValidateScopes`/`ValidateOnBuild` were enabled outside Development in `Program.cs`, so this misregistration class now fails fast at startup in any environment — a real "prevent the class of bug" action, not a proposed one.
- A known remaining gap to potentially list as a follow-up action: no automated regression test or DI-container lifetime assertion exists to catch a future revert of the Scoped registration.
- The review-checklist trace-back target: Item 3 (DI lifetime, AD-4) in `docs/review/code-review-checklist.md` is the canonical checklist entry for this bug, and the checklist document itself already flags Item 3 as the intended basis for Epic 5's SBI example — reuse its concrete Situation (Story 1.5's load test), Behavior (the exact misregistration line), and Impact (48/50 requests failing, full stack traces) rather than re-deriving them.
- Other checklist items with real, already-documented findings (usable if a different postmortem follow-up trace or a second SBI angle is wanted): Item 5 (check-then-act race in `CategoryService.DeleteAsync`), Item 6 (missing `OrderBy` on list queries), Item 7 (validation composability gap).

## Cross-Story Dependencies

- Story 5.1 (postmortem) and Story 5.5 (SBI) both depend on Epic 4's Story 4.3 checklist being complete — specifically Item 3's DI-lifetime finding, which both artifacts draw on independently. Keep the description of the underlying bug consistent across both.
- Story 5.1's follow-up actions and Story 5.5's SBI example should not simply duplicate each other — the postmortem's follow-up is process/systems-facing (the `ValidateOnBuild` guardrail, the missing regression test), while the SBI example is a feedback conversation grounded in the same finding.
- Stories 5.2-5.4 have no hard dependency on each other or on Story 5.1/5.5, but Story 5.4's hiring questions should draw broadly across Epics 1-4 artifacts (ADRs, the design doc, the checklist, the mentoring note), not just the DI bug already used by 5.1/5.5.
- All five stories depend on Epics 1-4 being complete, since every artifact must trace to a real decision, commit, bug, or checklist finding from that work.
