# Epic 4 Context: Tech Lead Artifacts

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic is documentation-only — it produces no application code. It compiles the artifacts a senior/lead engineer would produce alongside a build: architecture decision records, a scaling design doc, a code review checklist, and a mentoring note. Every artifact must trace back to something that actually happened in Epics 1-3 (a real decision, a real commit, a real bug) rather than being generic or hypothetical — that traceability is what makes the artifacts defensible in a tech-lead interview, not just decorative documentation.

## Stories

- Story 4.1: Architecture Decision Records
- Story 4.2: Design Doc — Scaling Path for a Non-Trivial Feature
- Story 4.3: Code Review Checklist Applied to Real Commits
- Story 4.4: Mentoring/Onboarding Note

## Requirements & Constraints

- 4-6 ADRs live in `/docs/adr/`, each in Context/Decision/Alternatives/Consequences shape, each documenting a real decision made building Epics 1-3.
- Each ADR names at least one alternative that was considered and rejected, with the tradeoff stated honestly — including cases where the chosen pattern is arguably redundant at this project's scale.
- The scaling design doc covers one non-trivial feature's scaling path (e.g. pagination, caching, indexing) with concrete tradeoffs, not generic advice.
- The code review checklist has 10-15 specific, actionable items (not generic "write good code" advice), applied retroactively against real commits, and surfaces at least one real, specific finding in the actual codebase — not a hypothetical. Each finding includes an example review comment written as if left on that commit.
- The mentoring note is aimed at a hypothetical mid-level engineer joining the codebase, explains the SOLID/pattern choices the way a senior engineer would explain them to a mid-level teammate, and lists things to watch out for — with the DI captive-dependency bug from Story 1.5 listed first.
- Downstream (Epic 5): at least one review-checklist finding must be usable as the basis for an SBI feedback-framework example, so findings should be specific enough to ground that.

## Technical Decisions

- ADR candidates named in planning: Repository/Unit-of-Work adoption (AD-2), DTO mapping strategy (AD-9 — manual `ToDto()`/`ToEntity()` extension methods, no AutoMapper), token storage strategy (AD-5 — httpOnly cookie, not localStorage), validation strategy (AD-8 — Data Annotations + `[ApiController]` model-state, no FluentValidation), DI lifetime choice (AD-4 — Scoped services/DbContext, with the deliberate captive-dependency reproduction as the documented exception), and Category deletion behavior (AD-10 — 409 Conflict, no cascade delete).
- ADR-002 is already earmarked in the architecture spine for the DTO mapping decision (AD-9) — reuse that numbering rather than renumbering.
- The Story 1.5 DI captive-dependency bug (a scoped service injected into a singleton) is the canonical "real bug" reference for this epic: it is the AD-4 exception, the required first mentoring-note warning, and a natural candidate for a review-checklist finding.
- No new architecture applies to this epic's own output — the ADRs, design doc, checklist, and mentoring note are markdown artifacts under `/docs`, not code, so no layering/DI/DTO rules from Epics 1-3 constrain how they're written. Those rules are instead the *subject matter* the artifacts document.

## Cross-Story Dependencies

- All four stories in this epic depend on Epics 1-3 being complete — each artifact draws on real decisions, commits, and bugs from those epics, so nothing here can be honestly written before that work exists.
- Story 4.3's checklist findings and Story 4.4's mentoring warnings both anchor on the same Story 1.5 DI bug used in Story 4.1's AD-4 ADR — keep the description of that bug consistent across all three artifacts.
- Epic 5 (Engineering Manager Artifacts) depends on this epic: FR-9's postmortem follow-up actions must trace to at least one Story 4.3 checklist item, and FR-11's SBI feedback example must apply to a real Story 4.3 finding.
