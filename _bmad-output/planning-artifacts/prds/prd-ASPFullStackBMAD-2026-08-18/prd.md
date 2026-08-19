---
title: "ASP.NET Core Full-Stack Portfolio Project (Senior / Tech Lead / EM Track)"
status: final
created: 2026-08-18
updated: 2026-08-18
---

*Working title — confirm.*

## 0. Document Purpose

This PRD is for the builder (Prasad), acting as his own PM, architect, and developer, and secondarily for anyone reviewing the finished project (an interviewer, a mentor giving feedback). It builds on `brief.md` and `addendum.md` (same run family, `_bmad-output/planning-artifacts/briefs/brief-ASPFullStackBMAD-2026-08-18/`) — this document does not re-explain the *why*, it turns the brief's four-track solution into concrete, buildable requirements. Features are grouped; functional requirements (FRs) are nested under each and numbered globally (FR-1 through FR-N) for stable downstream references. Technical-how (library choices, session-by-session build order) stays in the brief's addendum and this PRD's own `addendum.md` — this document describes capabilities, not implementation.

## 1. Vision

A clean, testable ASP.NET Core Web API + EF Core/MSSQL + React CRUD application (a Product/Category catalog), built alongside — and traceable to — the artifacts a senior developer, tech lead, or engineering manager actually produces: architecture decision records, a design doc, a code review checklist, a mentoring note, an incident postmortem, a roadmap, an estimation note, a hiring question set, a feedback-framework example, and a set of STAR interview stories. The application proves the code works; the artifact set proves the judgment behind it. Together they let Prasad walk any interviewer — senior IC, tech lead, or EM loop — through the same project and hold up under 30 minutes of follow-up questions.

## 2. Target User

### 2.1 Jobs To Be Done

- As the builder, I need one project I can point to across senior developer, tech lead, and EM interview loops, so I don't need three separate portfolio pieces.
- As the builder, I need every leadership artifact tied to something that actually happened in the build, so I never get caught improvising a story I can't back up.
- As the builder, I need to be able to deliver the project narrative from memory — 3 minutes cold, 30 minutes deep — so the interview performance doesn't depend on notes.
- As the (implicit) interviewer reading or hearing about this project, I need the artifacts to be legible and credible without having watched it get built, so I can evaluate judgment, not just output.

### 2.2 Non-Users (v1)

Not building this as teaching material for a general audience, and not claiming real team-management experience — EM artifacts are explicitly framed as demonstrative when discussed in interviews (see brief §Scope, Out).

### 2.3 Key User Journeys

*Lighter scope dial (hobby/solo) — single-sentence JTBD-style journeys rather than heavy multi-beat flows.*

- **UJ-1.** Prasad, in a senior-IC interview, walks the panel through the 3-minute capstone narrative cold, then answers one deep technical follow-up by pointing to the ADR that made the tradeoff explicit. Realizes FR-13, FR-7.
- **UJ-2.** Prasad, in a tech-lead interview, is asked "how do you review code" and walks through the code review checklist applied to a real commit in this codebase, including one comment he'd actually leave. Realizes FR-8.
- **UJ-3.** Prasad, in an EM interview, is asked "tell me about an incident" and walks through the blameless postmortem for the deliberately-injected captive-dependency bug — timeline, root cause, follow-up action. Realizes FR-9.

## 3. Glossary

- **Session** — a ~2-hour focused work block from the original 20-hour plan or its extension; the atomic planning unit (see addendum for the full session map).
- **Track** — one of the four groupings of work: Technical Spine, Tech Lead Artifacts, EM Artifacts, Interview Narrative Package.
- **ADR (Architecture Decision Record)** — a short document (Context / Decision / Alternatives / Consequences) capturing one real technical decision made during the build.
- **Postmortem (blameless)** — an incident write-up (timeline, impact, root cause, fix, follow-up actions) that assigns causes to systems and process, not people.
- **Capstone Review** — the end-to-end narrated walkthrough of the whole project; exists in a 3-minute cold version and an extended 30-minute deep-dive version.
- **STAR Story** — an interview answer structured as Situation / Task / Action / Result, extracted from a real artifact (an ADR, the postmortem, the roadmap work).
- **Artifact** — any of the non-code deliverables (ADR, design doc, checklist, postmortem, roadmap, estimation note, hiring question set, feedback example, STAR story).

## 4. Features

### 4.1 CRUD Application (Product/Category Catalog)

**Description:** The technical spine — a working ASP.NET Core Web API backed by EF Core/MSSQL, consumed by a React frontend, with authentication, validation, layered architecture (DTOs, services/repositories, DI), and automated tests. This is the object every artifact in 4.2–4.4 refers back to. Every non-trivial file carries comments explaining *why* a decision was made, not what the code does (see brief §Solution and addendum's Code Comment Standard) — this is itself a requirement, not a style preference, since the comments are part of what gets read in a technical deep-dive.

**Functional Requirements:**

#### FR-1: Product/Category CRUD API
The system exposes Create, Read (list + by-id), Update, and Delete endpoints for a Product/Category domain (one-to-many), backed by EF Core migrations against a real MSSQL instance.

**Consequences (testable):**
- All five endpoints return correct HTTP status codes (200/201/204/400/404) for success and failure cases.
- A `Category` deletion with existing `Product` rows either cascades or is rejected — one explicit, documented behavior, not undefined.

#### FR-2: Layered Architecture (DI, SOLID, Repository/Unit of Work)
The system separates controllers, services, and data access via constructor-injected interfaces (`IProductService`, `IProductRepository`, `IUnitOfWork`), registered with correct DI lifetimes.

**Consequences (testable):**
- No controller references `DbContext` directly.
- At least one deliberate DI-lifetime bug (scoped-into-singleton) is reproduced once, observed failing, then fixed — this failure is required input for FR-9 (postmortem).

#### FR-3: DTO Boundary and Validation
The API never returns EF entities directly; request/response shapes are DTOs, validated before reaching business logic.

**Consequences (testable):**
- Invalid input (e.g. missing required field) returns `400 Bad Request` with a structured error body, not a 500.
- No circular-reference or over-posting vulnerability reachable through the public API surface.

#### FR-4: JWT Authentication
Users can register and log in; a JWT is issued and required (`[Authorize]`) on all Product/Category mutation endpoints; CORS is scoped to the frontend origin.

**Consequences (testable):**
- An unauthenticated request to a protected endpoint returns `401`.
- Token expiry is enforced; an expired token is rejected, not silently accepted.

#### FR-5: React Frontend
A React app lists, creates, edits, and deletes Products against the API, attaching the JWT to each request, with loading and error states surfaced to the user.

**Consequences (testable):**
- A full create → list → edit → delete cycle succeeds through the UI without a page reload losing auth state.
- A simulated API failure (network error or 4xx) shows a visible error state, not a silent failure.

#### FR-6: Automated Test Coverage
The system includes automated unit tests (xUnit) for `ProductService`, with `IProductRepository` mocked (Moq), covering the core CRUD service methods.

**Consequences (testable):**
- At least 2–3 unit tests pass covering create/read/update/delete service logic without hitting a real database.
- The test suite runs green (`dotnet test`) before the capstone (FR-13) is considered complete.

**Feature-specific NFRs:**
- Structured logging with a correlation ID flows through every request (seed for FR-9's postmortem timeline).
- One resilience pattern (retry-with-backoff on transient failures only, not on 4xx) is applied to the frontend's API-calling layer.

**Notes:** `[NOTE FOR PM]` Confirm which specific bug becomes the injected incident for FR-9 before that session — the FR-2 DI captive-dependency bug is the current default assumption.

### 4.2 Tech Lead Artifacts

**Description:** Documents a senior/lead engineer would produce alongside the build — decisions, review standards, and mentoring communication — each tied to something that actually happened in 4.1.

#### FR-7: Architecture Decision Records
The project includes 4–6 ADRs (standard Context/Decision/Alternatives/Consequences shape) in `/docs/adr/`, each documenting a real decision made building 4.1 (e.g. Repository pattern adoption, DTO mapping strategy, token storage strategy).

**Consequences (testable):**
- Each ADR names at least one alternative that was considered and rejected, with the tradeoff stated honestly (including cases where the chosen pattern is arguably redundant).

#### FR-8: Design Doc, Review Checklist, Mentoring Note
The project includes one short design doc for a non-trivial feature's scaling path, one code review checklist (10–15 items) applied against real commits from 4.1 with example review comments, and one mentoring/onboarding note aimed at a hypothetical mid-level engineer joining the codebase.

**Consequences (testable):**
- The review checklist, applied retroactively, surfaces at least one real, specific finding in the actual codebase — not a hypothetical.
- The mentoring note references the FR-2 DI bug as the one thing it warns a new engineer about first.

### 4.3 Engineering Manager Artifacts

**Description:** Demonstrative EM-track documents — explicitly framed in any interview use as demonstrative, not real people-management history (brief §Scope, Out).

#### FR-9: Incident Postmortem
The project includes one blameless postmortem for the FR-2 DI captive-dependency bug (or another real bug hit during the build), covering timeline, impact (framed as production), root cause, fix, and follow-up actions that prevent the class of bug going forward.

**Consequences (testable):**
- The postmortem's follow-up actions connect concretely to FR-8's review checklist (at least one checklist item traces back to a postmortem action item).

#### FR-10: Roadmap and Estimation Note
The project includes a 2–3 horizon post-MVP roadmap and a short estimation-calibration note comparing planned vs. actual time across the build's sessions.

**Consequences (testable):**
- Each roadmap horizon states a user- or business-facing reason, not just a feature name.
- The estimation note names at least one session where actual time diverged from planned and why.

#### FR-11: Hiring Question Set and Feedback Example
The project includes a 5–8 question hiring-loop question set derived from the actual codebase, and one feedback-framework example (e.g. SBI: Situation-Behavior-Impact) applied to a real finding from FR-8's review checklist.

**Consequences (testable):**
- Each hiring question references a specific artifact or code decision from 4.1/4.2 that grounds it (not generic trivia).

### 4.4 Interview Narrative Package

**Description:** Packaging that turns 4.2 and 4.3's artifacts into something deliverable live, under interview conditions, from memory.

#### FR-12: STAR Stories
The project includes 3–4 STAR-format stories, each extracted from a specific artifact in 4.2 or 4.3 (a tradeoff decision, the bug/postmortem, a stakeholder-communication moment, a mentoring moment).

**Consequences (testable):**
- Each STAR story can be delivered verbally in under 2 minutes without notes.

#### FR-13: Capstone Review (3-minute and 30-minute)
The project includes both the original 3-minute cold capstone walkthrough and an extended 30-minute deep-dive version, plus 8–10 anticipated follow-up questions (one per artifact) with prepared answers.

**Consequences (testable):**
- Both versions are deliverable from memory, no notes, per the original plan's own review discipline.
- At least one follow-up question per track (technical, tech lead, EM) is included in the anticipated set.

## 5. Non-Goals (Explicit)

- Not building advanced EF Core internals, SignalR, gRPC, background jobs (Hangfire), Redux/NgRx-scale state management, Docker/Kubernetes deployment, or the full Gang-of-Four pattern catalog.
- Not claiming a real production incident — FR-9's postmortem is explicitly a deliberately injected bug.
- Not claiming real team-management experience — FR-10/FR-11 are demonstrative and must be framed as such.
- Not building a second frontend framework track (Angular) — stays React; noted in the brief as swappable later.

## 6. MVP Scope

### 6.1 In Scope

- FR-1 through FR-13, all four features.
- Code comments explaining *why*, per the addendum's Code Comment Standard, on every non-trivial file.

### 6.2 Out of Scope for MVP

- A live, deployed version of the application (local/dev-only is sufficient — no hosting/deployment requirement in v1).
- A second interview-track variant for a different tech stack (e.g. redoing this in Angular or a different backend) — `[NOTE FOR PM]` explicitly parked as a possible v2 if the job search targets an Angular-specific role.
- Real user feedback or usage data on the artifacts (e.g. running the hiring question set on an actual candidate) — v1 is self-assessed only.

## 7. Success Metrics

**Primary**
- **SM-1**: Capstone deliverability — both the 3-minute and 30-minute versions of FR-13 can be delivered from memory without breaking down. Validates FR-12, FR-13.
- **SM-2**: Artifact traceability — 100% of artifacts in 4.2–4.4 trace to a real, specific event or decision in 4.1 (spot-checked, not just asserted). Validates FR-7 through FR-11.

**Secondary**
- **SM-3**: Cross-track coverage — at least one credible answer prepared per interview track (senior IC, tech lead, EM). Validates FR-7, FR-9, FR-11.

**Counter-metrics (do not optimize)**
- **SM-C1**: Raw artifact count. Producing more ADRs or more STAR stories than needed, at the cost of traceability (SM-2) or delivery fluency (SM-1), is a regression, not progress. Counterbalances SM-2.

## 8. Open Questions

1. Which specific bug becomes FR-9's injected incident — confirmed default is the FR-2 DI captive-dependency bug, but this should be locked before that session runs.
2. Is there a target company/role posting this project should be calibrated against, or is it deliberately generic across senior/lead/EM loops?
3. Is there a hard deadline (an actual interview loop already scheduled) that should compress the ~40–46h estimate from the addendum?

## 9. Assumptions Index

- §4.1 FR-9 Notes — `[ASSUMPTION]` the FR-2 DI captive-dependency bug is the default injected incident for the postmortem; confirm before that session (also Open Question 1).
- §2.3 — `[ASSUMPTION]` "the interviewer" is treated as an implicit secondary user for legibility purposes only; no interviewer feedback loop exists in v1 (see §6.2).
