---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['_bmad-output/planning-artifacts/prds/prd-ASPFullStackBMAD-2026-08-18/prd.md', '_bmad-output/planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md']
---

# ASPFullStackBMAD - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for ASPFullStackBMAD, decomposing the requirements from the PRD and Architecture Spine into implementable stories. No UX design contract exists for this project (a UX pass was judged unnecessary for a thin CRUD admin-style UI — see brief/PRD).

## Requirements Inventory

### Functional Requirements

FR1: The system exposes Create, Read (list + by-id), Update, and Delete endpoints for a Product/Category domain (one-to-many), backed by EF Core migrations against a real MSSQL instance.
FR2: The system separates controllers, services, and data access via constructor-injected interfaces (IProductService, IProductRepository, IUnitOfWork), registered with correct DI lifetimes.
FR3: The API never returns EF entities directly; request/response shapes are DTOs, validated before reaching business logic.
FR4: Users can register and log in; a JWT is issued and required ([Authorize]) on all Product/Category mutation endpoints; CORS is scoped to the frontend origin.
FR5: A React app lists, creates, edits, and deletes Products against the API, attaching auth to each request, with loading and error states surfaced to the user.
FR6: The system includes automated unit tests (xUnit) for ProductService, with IProductRepository mocked (Moq), covering the core CRUD service methods.
FR7: The project includes 4-6 Architecture Decision Records (ADRs) in /docs/adr/, each documenting a real decision made building FR1-FR6.
FR8: The project includes one short design doc for a non-trivial feature's scaling path, one code review checklist (10-15 items) applied against real commits with example review comments, and one mentoring/onboarding note.
FR9: The project includes one blameless postmortem for the FR2 DI captive-dependency bug (or another real bug hit during the build), covering timeline, impact, root cause, fix, and follow-up actions.
FR10: The project includes a 2-3 horizon post-MVP roadmap and a short estimation-calibration note comparing planned vs. actual time across the build's sessions.
FR11: The project includes a 5-8 question hiring-loop question set derived from the actual codebase, and one feedback-framework example (e.g. SBI) applied to a real finding from FR8's review checklist.
FR12: The project includes 3-4 STAR-format stories, each extracted from a specific artifact in FR7-FR11.
FR13: The project includes both a 3-minute cold capstone walkthrough and an extended 30-minute deep-dive version, plus 8-10 anticipated follow-up questions with prepared answers.

### NonFunctional Requirements

NFR1: Structured logging with a correlation ID flows through every request (PRD FR1 feature-specific NFR; Architecture AD-6).
NFR2: The frontend's API-calling layer applies a resilience pattern — retry-with-backoff on transient failures/5xx only, never on 4xx (PRD FR5 feature-specific NFR; Architecture AD-7).
NFR3: Every non-trivial file carries comments explaining *why* a decision was made, not what the code does (PRD §4.1 Description; brief's Code Comment Standard) — a cross-cutting quality requirement on all code stories, not a standalone feature.

### Additional Requirements

From `ARCHITECTURE-SPINE.md` (binding invariants — see the spine for full Binds/Prevents/Rule):

- **AD-1 Layered project boundaries**: solution scaffolded as 4 projects — Api, Application, Domain, Infrastructure — with Domain depending on nothing, Infrastructure implementing Domain/Application interfaces, Api wiring Infrastructure only in `Program.cs`. This is the Epic 1 / Story 1 scaffold: no separate "starter template" beyond this structure.
- **AD-2 Repository + Unit of Work**: `IProductRepository`/`IUnitOfWork` in Domain, implementations in Infrastructure.
- **AD-3 DTO boundary**: DTOs live in Application; Domain entities never cross the Api boundary.
- **AD-4 DI lifetimes**: DbContext + repositories = Scoped; app services = Scoped by default. A one-time deliberate scoped-into-singleton violation is required as input to FR9 — reproduce, observe failure, then fix.
- **AD-5 Token storage**: JWT issued as an httpOnly/Secure/SameSite cookie; React never touches the raw token; mutating requests carry a CSRF/anti-forgery token.
- **AD-6 Correlation ID**: middleware assigns `X-Correlation-Id` per request, attached to the `ILogger` scope.
- **AD-7 Frontend resilience**: exponential backoff, max 3 attempts, network/5xx only.
- **AD-8 Validation** `[ASSUMPTION]`: Data Annotations + `[ApiController]` auto-400, no FluentValidation.
- **AD-9 Mapping** `[ASSUMPTION]`: manual `ToDto()`/`ToEntity()` extension methods, no AutoMapper.
- **AD-10 Category deletion** `[ASSUMPTION]`: reject with `409 Conflict` when a Category has existing Products; no cascade.
- **Error envelope**: all 4xx/5xx responses use RFC 7807 `ProblemDetails`.
- **Stack** (seed, versions verified 2026-08-18): .NET/ASP.NET Core 10, EF Core 10.x, SQL Server (LocalDB/Developer), React 19.x + Vite, xUnit + Moq.
- **Deployment**: explicitly out of scope for v1 (local dev only — no hosting/CI/CD epic needed).

### UX Design Requirements

Not applicable — no UX design contract exists for this project.

### FR Coverage Map

| FR | Epic |
| --- | --- |
| FR1 | Epic 1 |
| FR2 | Epic 1 |
| FR3 | Epic 1 |
| FR6 | Epic 1 |
| FR4 | Epic 2 |
| FR5 | Epic 3 |
| FR7 | Epic 4 |
| FR8 | Epic 4 |
| FR9 | Epic 5 |
| FR10 | Epic 5 |
| FR11 | Epic 5 |
| FR12 | Epic 6 |
| FR13 | Epic 6 |

## Epic List

1. **Epic 1 — CRUD API Foundation** (FR1, FR2, FR3, FR6, NFR1, NFR3) — scaffold the 4-project solution, Product/Category CRUD, layered architecture, DTOs, and unit tests.
2. **Epic 2 — Authentication & Authorization** (FR4, AD-5) — register/login, JWT-via-cookie, protect mutation endpoints, CORS.
3. **Epic 3 — React Frontend** (FR5, NFR2) — list/create/edit/delete UI against the protected API, with resilience.
4. **Epic 4 — Tech Lead Artifacts** (FR7, FR8) — ADRs, design doc, review checklist, mentoring note.
5. **Epic 5 — Engineering Manager Artifacts** (FR9, FR10, FR11) — postmortem, roadmap/estimation, hiring/feedback materials.
6. **Epic 6 — Interview Narrative Package** (FR12, FR13) — STAR stories, capstone walkthroughs.

## Epic 1: CRUD API Foundation

Scaffold the layered solution and deliver full Category/Product CRUD against a real MSSQL instance, with the architecture invariants (DI, DTOs, correlation IDs) wired in from the start. Covers FR1, FR2, FR3, FR6; NFR1, NFR3 (cross-cutting); binds AD-1, AD-2, AD-3, AD-4, AD-6, AD-8, AD-9, AD-10.

### Story 1.1: Solution Scaffold & Domain Model

As a developer,
I want the four-project solution (Domain/Application/Infrastructure/Api) scaffolded with the `Category`/`Product` entities, `IProductRepository`/`IUnitOfWork` interfaces, `DbContext`, and an initial EF Core migration against MSSQL,
So that CRUD features have a compiling, architecturally-correct foundation to build on.

**Acceptance Criteria:**

**Given** the solution doesn't exist
**When** scaffolded
**Then** `Domain` has zero project references and `Infrastructure` is referenced by `Api` only in `Program.cs`

**Given** the entities are defined
**When** the initial migration runs
**Then** `Category` and `Product` tables exist in MSSQL with the FK relationship (AD-10 applies at delete time, not creation)

**Given** `IProductRepository`/`IUnitOfWork` are defined in Domain
**When** Infrastructure implements them
**Then** Application/Api reference only the interfaces

### Story 1.2: Category CRUD

As an API consumer,
I want Create/Read(list+by-id)/Update/Delete endpoints for Category,
So that I can manage the catalog's category taxonomy.

**Acceptance Criteria:**

**Given** a valid Category payload
**When** POSTed
**Then** a 201 is returned with the created DTO (never the EF entity — AD-3)

**Given** an invalid payload (missing Name)
**When** POSTed
**Then** a 400 with a `ProblemDetails` body is returned (AD-8)

**Given** a Category with existing Products
**When** DELETE is called
**Then** a 409 Conflict is returned and no cascade occurs (AD-10)

**Given** a Category with no Products
**When** DELETE is called
**Then** a 204 is returned

**Given** the controller
**When** it handles any Category request
**Then** it calls only `ICategoryService` — never `DbContext` directly (AD-1, AD-2)

### Story 1.3: Product CRUD

As an API consumer,
I want Create/Read(list+by-id)/Update/Delete endpoints for Product,
So that I can manage catalog items under a category.

**Acceptance Criteria:**

**Given** a valid Product payload referencing an existing Category
**When** POSTed
**Then** a 201 is returned with the created DTO

**Given** a Product payload referencing a non-existent Category
**When** POSTed
**Then** a 400/404 is returned, not a 500

**Given** an invalid payload
**When** POSTed
**Then** a 400 with `ProblemDetails` is returned

**Given** a Product id that doesn't exist
**When** GET/PUT/DELETE is called
**Then** a 404 is returned

**Given** mapping is manual (AD-9)
**When** entities cross the DTO boundary
**Then** `ToDto()`/`ToEntity()` extension methods perform the conversion, no AutoMapper

### Story 1.4: Correlation ID & Structured Logging

As an operator,
I want every request to carry a correlation ID through structured logs,
So that a request's full lifecycle can be reconstructed later (this seeds FR9's postmortem timeline).

**Acceptance Criteria:**

**Given** a request without `X-Correlation-Id`
**When** it arrives
**Then** middleware generates one and attaches it to the `ILogger` scope for that request

**Given** a request with `X-Correlation-Id` already set
**When** it arrives
**Then** the existing value is preserved and used

**Given** any log line emitted during the request
**When** it's written
**Then** it includes the correlation ID

### Story 1.5: Deliberate DI Lifetime Bug (Reproduce → Observe → Fix)

As a developer,
I want to reproduce a scoped-into-singleton captive-dependency bug once, observe it fail, then fix it,
So that this failure exists as real, reproducible input for FR9's postmortem rather than a hypothetical.

**Acceptance Criteria:**

**Given** a repository is temporarily registered as Singleton while depending on a Scoped `DbContext`
**When** two concurrent requests hit it
**Then** a captive-dependency failure is observed and logged (with correlation ID from Story 1.4)

**Given** the failure is documented (log excerpt saved for FR9)
**When** the fix is applied
**Then** the repository is correctly Scoped and the failure no longer reproduces

**Given** the fix is in place
**When** DI lifetimes are reviewed
**Then** AD-4's rule (DbContext/repositories = Scoped) holds with no standing exception

### Story 1.6: Unit Tests for ProductService

As a developer,
I want xUnit tests for `ProductService` with `IProductRepository` mocked via Moq,
So that core CRUD service logic is verified without hitting a real database.

**Acceptance Criteria:**

**Given** `IProductRepository` is mocked
**When** Create/Read/Update/Delete service methods are tested
**Then** all pass without a live DB connection

**Given** the test suite
**When** `dotnet test` runs
**Then** it's green (required before FR13's capstone)

**Given** the core CRUD paths
**When** covered by tests
**Then** at least 2-3 tests exist per FR6

## Epic 2: Authentication & Authorization

Users can register and log in; mutation endpoints require a valid JWT delivered securely; CORS is scoped to the frontend. Covers FR4; binds AD-5.

### Story 2.1: User Registration

As a new user,
I want to register with email/password,
So that I can access the system.

**Acceptance Criteria:**

**Given** a valid, unused email + password
**When** POSTed to `/api/auth/register`
**Then** a 201 is returned and the password is stored hashed, never in plaintext

**Given** an email already registered
**When** POSTed
**Then** a 409/400 is returned, not a 500

**Given** an invalid payload (missing password, malformed email)
**When** POSTed
**Then** a 400 with `ProblemDetails` is returned

### Story 2.2: User Login (JWT via httpOnly Cookie)

As a registered user,
I want to log in and receive a session,
So that I can access protected endpoints without handling a raw token myself.

**Acceptance Criteria:**

**Given** valid credentials
**When** POSTed to `/api/auth/login`
**Then** the JWT is issued as an `httpOnly`, `Secure`, `SameSite` cookie (AD-5) — never in the response body

**Given** invalid credentials
**When** POSTed
**Then** a 401 is returned

**Given** an expired token
**When** used on a subsequent request
**Then** it's rejected, not silently accepted

### Story 2.3: Protect Mutation Endpoints & Scope CORS

As a system operator,
I want all Category/Product mutation endpoints protected and CORS locked to the frontend origin,
So that only authenticated requests from the trusted client can modify data.

**Acceptance Criteria:**

**Given** an unauthenticated request
**When** it hits a Create/Update/Delete endpoint from Epic 1
**Then** a 401 is returned

**Given** a mutating request (POST/PUT/DELETE)
**When** it lacks a valid CSRF/anti-forgery token
**Then** it's rejected server-side (AD-5)

**Given** a request from an origin other than the configured frontend origin
**When** it arrives
**Then** CORS blocks it

**Given** Read (GET) endpoints
**When** accessed without authentication
**Then** they remain publicly accessible per FR4's mutation-only scope

## Epic 3: React Frontend

A React app lists, creates, edits, and deletes Products against the protected API, with loading/error states and resilient network calls. Covers FR5; NFR2; binds AD-7. Scoped to Products only — no Category management UI.

### Story 3.0: Minimal Login Form (Epic 3 prerequisite)

**Retro reconciliation (Epic 3, Finding L, added 2026-08-22):** this story existed and shipped from the start of Epic 3's implementation — delivered as an ad-hoc, unnumbered spec (`spec-epic-3-prereq-login-form.md`) after Story 3.3's own drafting surfaced that no story anywhere specified how the frontend would obtain the authenticated, CSRF-token-bearing session Epic 2's backend requires for every mutation. This entry formally records it as delivered Epic 3 scope, closing the gap between "Epic 2 built auth" and "Epic 3 assumes auth exists" that a reader of this file alone would otherwise see with no visible bridge.

As a user,
I want to log in before I can manage products,
So that Create/Edit/Delete have the authenticated, CSRF-protected session Epic 2 requires.

**Acceptance Criteria:**

**Given** the app mounts and a session check (`GET /api/auth/me`) is in flight
**When** rendering
**Then** a brief loading indicator is shown — neither the login form nor the product views

**Given** no existing session (`/me` → 401)
**When** the session check resolves
**Then** the login form is shown

**Given** a valid existing session (`/me` → 200)
**When** the session check resolves
**Then** the product views render directly, login form skipped

**Given** valid credentials submitted
**When** `POST /api/auth/login` succeeds and the follow-up `/me` re-check (minting the CSRF cookie, Story 2.3) also succeeds
**Then** the app transitions to authenticated and renders the product views, with no page reload

**Given** invalid credentials or a network/server failure
**When** login fails
**Then** a visible inline error is shown and the form stays editable

### Story 3.1: API Client Foundation & Resilience Layer

As a developer,
I want a shared API client that includes credentials on every request and retries transient failures,
So that all feature calls share consistent auth and resilience behavior.

**Acceptance Criteria:**

**Given** any request to the API
**When** sent
**Then** credentials (the httpOnly auth cookie) are included automatically

**Given** a network failure or 5xx response
**When** it occurs
**Then** the client retries with exponential backoff, max 3 attempts (AD-7)

**Given** a 4xx response
**When** it occurs
**Then** the client does not retry

### Story 3.2: Product List View

As a user,
I want to see the list of products,
So that I know what's in the catalog.

**Acceptance Criteria:**

**Given** products exist
**When** the list view loads
**Then** they're fetched and displayed

**Given** the fetch is in flight
**When** rendering
**Then** a loading state is shown

**Given** the fetch fails (network error or 4xx/5xx)
**When** it happens
**Then** a visible error state is shown, not a silent failure

### Story 3.3: Create Product

As a user,
I want to create a new product,
So that it appears in the catalog.

**Acceptance Criteria:**

**Given** a valid form submission
**When** submitted
**Then** the product is created via the API and the list reflects it without a page reload

**Given** an invalid submission (API returns 400)
**When** it happens
**Then** field-level or form-level errors are surfaced to the user

**Given** the request is in flight
**When** rendering
**Then** a loading state is shown on the form

### Story 3.4: Edit Product

As a user,
I want to edit an existing product,
So that its details stay accurate.

**Acceptance Criteria:**

**Given** an existing product
**When** edited and submitted
**Then** the update is persisted via the API and reflected in the list

**Given** an invalid edit
**When** submitted
**Then** validation errors are shown

**Given** the edit fails due to a network/server error
**When** it happens
**Then** a visible error state is shown

### Story 3.5: Delete Product

As a user,
I want to delete a product,
So that it no longer appears in the catalog.

**Acceptance Criteria:**

**Given** an existing product
**When** delete is confirmed
**Then** it's removed via the API and disappears from the list

**Given** the delete fails (network/server error)
**When** it happens
**Then** a visible error state is shown and the item remains in the list

**Given** the full create → list → edit → delete cycle
**When** exercised end-to-end
**Then** auth state is preserved throughout without a page reload (per PRD FR-5 consequence)

## Epic 4: Tech Lead Artifacts

Produce the documents a senior/lead engineer would generate alongside the build — decisions, review standards, mentoring communication — each tied to something that actually happened in Epics 1-3. Covers FR7, FR8.

### Story 4.1: Architecture Decision Records

As the builder,
I want 4-6 ADRs in `/docs/adr/` documenting real decisions made building Epics 1-3,
So that an interviewer can see the tradeoff reasoning, not just the outcome.

**Acceptance Criteria:**

**Given** the build is complete through Epic 3
**When** ADRs are written
**Then** each covers a real decision (candidates: Repository/UoW adoption, DTO mapping strategy AD-9, token storage AD-5, validation strategy AD-8, DI lifetime choice AD-4, Category deletion behavior AD-10)

**Given** each ADR
**When** reviewed
**Then** it names at least one alternative considered and rejected, with the tradeoff stated honestly — including where the chosen pattern is arguably redundant for this project's scale

**Given** the ADR count
**When** counted
**Then** it falls between 4 and 6

### Story 4.2: Design Doc — Scaling Path for a Non-Trivial Feature

As the builder,
I want a short design doc on how one non-trivial feature would scale,
So that I can speak to system-design tradeoffs beyond the current MVP.

**Acceptance Criteria:**

**Given** a feature is chosen (e.g. Product listing under load)
**When** the doc is written
**Then** it covers the scaling path (pagination, caching, indexing, or similar) with concrete tradeoffs, not generic advice

### Story 4.3: Code Review Checklist Applied to Real Commits

As the builder,
I want a 10-15 item code review checklist applied against real commits from this build,
So that I can walk through concrete review practice in a tech-lead interview.

**Acceptance Criteria:**

**Given** the checklist is written
**When** it has 10-15 items
**Then** each is specific and actionable (not generic "write good code" advice)

**Given** the checklist is applied retroactively to real commits
**When** applied
**Then** it surfaces at least one real, specific finding in the actual codebase — not a hypothetical

**Given** each finding
**When** documented
**Then** an example review comment is written as if left on that commit

### Story 4.4: Mentoring/Onboarding Note

As the builder,
I want a mentoring note aimed at a hypothetical mid-level engineer joining the codebase,
So that I can demonstrate how I'd onboard a teammate.

**Acceptance Criteria:**

**Given** the note is written
**When** it covers the codebase's key patterns
**Then** it explains the SOLID/pattern choices the way a senior engineer would explain them to a mid-level teammate

**Given** the note
**When** it lists things to watch out for
**Then** the FR-2/Story 1.5 DI captive-dependency bug is the first thing it warns about (per PRD FR-8 consequence)

## Epic 5: Engineering Manager Artifacts

Demonstrative EM-track documents — explicitly framed as demonstrative, not real people-management history — each tied to a real artifact or event from Epics 1-4. Covers FR9, FR10, FR11.

### Story 5.1: Incident Postmortem (Blameless)

As the builder,
I want a blameless postmortem for the Story 1.5 DI captive-dependency bug,
So that I can walk an EM interviewer through incident response.

**Acceptance Criteria:**

**Given** the postmortem is written
**When** reviewed
**Then** it covers timeline (using Story 1.4's correlation-ID logs), impact (framed as production), root cause, fix, and follow-up actions

**Given** the follow-up actions
**When** cross-checked
**Then** at least one traces concretely to a Story 4.3 review-checklist item (per PRD FR-9 consequence)

### Story 5.2: Post-MVP Roadmap

As the builder,
I want a 2-3 horizon post-MVP roadmap,
So that I can speak to product direction in an EM interview.

**Acceptance Criteria:**

**Given** each horizon
**When** stated
**Then** it names a user- or business-facing reason, not just a feature name

### Story 5.3: Estimation Calibration Note

As the builder,
I want a short note comparing planned vs. actual time across this build's sessions,
So that I can demonstrate estimation self-awareness.

**Acceptance Criteria:**

**Given** the note
**When** written
**Then** it names at least one session where actual time diverged from planned and why

### Story 5.4: Hiring Question Set

As the builder,
I want a 5-8 question hiring-loop question set derived from this codebase,
So that I can demonstrate interview-loop design as a tech-lead/EM skill.

**Acceptance Criteria:**

**Given** each question
**When** written
**Then** it references a specific artifact or code decision from Epics 1-4 — not generic trivia

**Given** the question count
**When** counted
**Then** it falls between 5 and 8

### Story 5.5: Feedback Framework Example (SBI)

As the builder,
I want one SBI (Situation-Behavior-Impact) feedback example applied to a real Story 4.3 checklist finding,
So that I can demonstrate a structured feedback approach in an EM interview.

**Acceptance Criteria:**

**Given** the SBI example
**When** written
**Then** it's grounded in the actual finding surfaced by Story 4.3's checklist, not a hypothetical

## Epic 6: Interview Narrative Package

Package Epics 4-5's artifacts into something deliverable live, under interview conditions, from memory. Covers FR12, FR13.

### Story 6.1: STAR Stories

As the builder,
I want 3-4 STAR-format stories extracted from Epic 4/5 artifacts,
So that I have ready interview answers grounded in real project events.

**Acceptance Criteria:**

**Given** each STAR story
**When** extracted
**Then** it's sourced from a specific Epic 4 or 5 artifact (a tradeoff decision, the postmortem, a stakeholder-communication moment, a mentoring moment)

**Given** each story
**When** delivered verbally
**Then** it takes under 2 minutes without notes

**Given** the story count
**When** counted
**Then** it falls between 3 and 4

### Story 6.2: 3-Minute Cold Capstone Walkthrough

As the builder,
I want a 3-minute cold walkthrough of the whole project,
So that I can open any interview with a tight, memorized narrative.

**Acceptance Criteria:**

**Given** the walkthrough
**When** delivered from memory with no notes
**Then** it completes in approximately 3 minutes and covers the project end-to-end

### Story 6.3: 30-Minute Deep-Dive & Anticipated Follow-Ups

As the builder,
I want an extended 30-minute deep-dive version plus 8-10 anticipated follow-up questions with prepared answers,
So that I can sustain a full technical/leadership interview without the story falling apart.

**Acceptance Criteria:**

**Given** the deep-dive
**When** delivered from memory
**Then** it sustains 30 minutes without breaking down (per PRD SM-1)

**Given** the follow-up question set
**When** reviewed
**Then** it has 8-10 questions, one per Epic 4/5 artifact

**Given** the question set
**When** checked against interview tracks
**Then** at least one question per track (technical, tech lead, EM) is included (per PRD FR-13 consequence)
