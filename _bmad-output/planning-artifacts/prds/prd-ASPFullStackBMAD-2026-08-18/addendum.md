# Addendum: PRD Supplement

Companion to `prd.md`. For the full session-by-session build order, resource picks, and the code comment standard, see the brief's own addendum: `_bmad-output/planning-artifacts/briefs/brief-ASPFullStackBMAD-2026-08-18/addendum.md` — not duplicated here.

## Technical-How Notes for Architecture Phase

- **FR-1 cascade behavior:** not yet decided whether `Category` deletion with existing `Product` rows cascades or is rejected with a `409`/`400`. Either is acceptable per FR-1's testable consequence ("one explicit, documented behavior"); the architecture pass should pick one and record the reasoning as an ADR (feeds FR-6's ADR count).
- **FR-2 DI bug reproduction:** the scoped-into-singleton bug should be reproduced by injecting `IProductService` (scoped) into a singleton-registered logging/metrics wrapper, or similar — architecture should confirm the concrete mechanism so FR-8's postmortem timeline is accurate rather than staged after the fact.
- **FR-4 token storage:** brief's ADR-003 candidate (httpOnly cookie vs. localStorage) is still open at PRD stage — this is a real architecture decision, not just documentation; carry it into the architecture pass rather than deciding it retroactively for the ADR.

## Rejected Alternative (PRD-stage)

- Considered structuring §4 Features around the four brief "tracks" as literal feature names (Technical / Tech Lead / EM / Narrative) verbatim. Rejected in favor of product-shaped feature names (CRUD Application, Tech Lead Artifacts, EM Artifacts, Interview Narrative Package) so FRs read as capabilities rather than curriculum-session labels — better fit for downstream architecture/epics consumption.
