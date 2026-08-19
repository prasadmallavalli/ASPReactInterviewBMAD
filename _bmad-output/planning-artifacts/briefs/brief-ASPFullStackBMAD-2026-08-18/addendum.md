# Addendum: Expanded Session Plan (Senior / Tech Lead / EM Track)

Companion to `brief.md`. This holds the session-by-session detail, resource picks, and artifact specs that don't fit the brief's 1-2 page shape. Downstream (PRD, architecture, epics/stories) should read this alongside the brief.

## Code Comment Standard (applies to every session)

Every non-trivial file gets comments that explain **why**, not what — the hidden constraint, the tradeoff rejected, the bug a pattern prevents. Rule of thumb: if a mid-level engineer reading the code without you in the room would ask "wait, why not just—", that question's answer is the comment. Never restate what the identifier already says.

Example (good vs. bad):
```csharp
// BAD — restates the code
// Loop through products and filter by category
var filtered = products.Where(p => p.CategoryId == categoryId);

// GOOD — explains the non-obvious why
// Filtering in-memory here, not via SQL WHERE, because CategoryId comes from
// a cached lookup that's already 1-2 requests stale by design (see ADR-003).
// A DB-side filter would silently disagree with what the UI just showed.
var filtered = products.Where(p => p.CategoryId == categoryId);
```

---

## Part A — Technical Spine (Sessions 1-10, expanded)

Same order and hands-on deliverables as the original plan. Each session keeps its original scope and adds a "Senior-level addition" — extra depth that turns the same hands-on work into something defensible at a staff/lead level.

### Session 1 (2h) — ASP.NET Core Web API Fundamentals
Original scope unchanged: routing, controllers vs minimal APIs, `[ApiController]`, model binding, middleware pipeline order.

**Senior-level addition:** Add structured logging (`ILogger<T>` with scopes) and a correlation-ID middleware early — every request gets a trace ID that flows through logs. This is the seed of the observability story you'll reference in Session 11's incident postmortem.

**New review question:** Why does middleware order matter for security (e.g., auth before authorization, exception handling wrapping everything)?

### Session 2 (2h) — EF Core + MSSQL
Original scope unchanged: `DbContext`, migrations, LINQ, `Include()`, async.

**Senior-level addition:** Note (don't necessarily implement) where N+1 queries would appear with naive `Include()` usage, and how you'd detect it (EF Core logging, `AsSplitQuery()`). This is raw material for an ADR on query strategy.

### Session 3 (2h) — Dependency Injection
Original scope unchanged: `AddScoped`/`AddTransient`/`AddSingleton`, constructor injection.

**Senior-level addition:** Deliberately reproduce the captive-dependency bug (inject a scoped service into a singleton) once, see it fail, then fix it. This becomes your postmortem's injected bug (Part C).

### Session 4 (2h) — SOLID Principles
Unchanged. Refactor `ProductService` to violate then fix one principle.

**Senior-level addition:** Write the SRP fix up as a 1-paragraph mentoring note — as if explaining to a mid-level engineer *why* the split matters, not just that it happened. This becomes raw material for Part B's mentoring artifact.

### Session 5 (2h) — Design Patterns
Unchanged: Repository + Unit of Work, Factory, Strategy, Decorator.

**Senior-level addition:** Write ADR-001: "Repository Pattern over Direct DbContext Access" — state the decision, the alternative considered (inject `DbContext` directly), the tradeoff (yes, it's sometimes redundant over EF Core — say so), and why you chose it anyway for this project.

### Session 6 (2h) — DTOs, Validation, AutoMapper
Unchanged.

**Senior-level addition:** Write ADR-002: "DTO Mapping Strategy" (AutoMapper vs. manual) — real tradeoff: AutoMapper reduces boilerplate but hides mapping bugs until runtime; manual mapping is more code but compiler-checked.

### Session 7 (2h) — JWT + Identity
Unchanged: register/login, JWT issuance, `[Authorize]`, CORS.

**Senior-level addition:** Add basic security hardening beyond the tutorial default — token expiry + refresh-token concept (even if refresh isn't fully implemented, document the gap), rate-limiting the login endpoint conceptually. Write ADR-003: "Token Storage Strategy" (httpOnly cookie vs. localStorage) with the XSS tradeoff spelled out.

### Session 8 (2h) — React Essentials
Unchanged (or Angular per the original note).

**Senior-level addition:** None required — this session stays scoped to "enough React to consume the API."

### Session 9 (2h) — Full CRUD Integration
Unchanged.

**Senior-level addition:** Add one resilience pattern to the API-calling layer — a simple retry-with-backoff on the fetch/axios layer, documented with *why* (transient network failure vs. real 4xx/5xx — don't retry on 4xx).

### Session 10 (2h) — Testing + Capstone Review
Unchanged: xUnit + Moq, deployment concepts pass, 3-minute capstone review.

**Senior-level addition:** The 3-minute review becomes the *short-form* version. The extended 30-minute version lives in Part D.

**Subtotal: ~20h (unchanged from original).**

---

## Part B — Tech Lead Track (new, ~8-10h)

Builds on the ADRs and mentoring note seeded above.

### Session 11 (2h) — ADR Consolidation + Design Doc
- Consolidate ADR-001 through ADR-003 from Part A into a proper `/docs/adr/` folder using a standard ADR template (Context / Decision / Alternatives / Consequences).
- Write ADR-004 or ADR-005 for one more real decision not yet captured (e.g., sync vs. async controller actions, or the auth flow choice from Session 7).
- Write a short design doc (1-2 pages) for one non-trivial feature — e.g., "how product search/filtering would scale past 10k rows." Include the alternatives you didn't build and why.

**Resources:** Michael Nygard's ADR format (the original one-pager); any "RFC template" search for a real-world example.

**Review:** Explain what an ADR is *for* — who reads it, six months later, and what decision it prevents from being re-litigated.

### Session 12 (2h) — Code Review Standards
- Write a short code review checklist (10-15 items) covering the things this codebase actually demonstrates: DI lifetime misuse, entity-leak-through-API, missing validation, N+1 risk, test coverage gaps.
- Apply it retroactively to 2-3 of your own commits — find at least one real thing you'd flag if this were a teammate's PR, and note how you'd phrase the review comment (direct but not harsh).

**Review:** What's the difference between a blocking comment and a nit? How do you calibrate that as a reviewer?

### Session 13 (1.5-2h) — Mentoring Artifact
- Expand the Session 4 mentoring note into a short "if I were onboarding a mid-level engineer onto this codebase" doc — the 3-5 things you'd point them to first, and the one mistake you'd warn them about before they made it (tie to the captive-dependency bug from Session 3).

**Review:** What's different about explaining a concept to unblock someone vs. explaining it to *teach* them the underlying principle?

---

## Part C — Engineering Manager Track (new, ~8-10h)

Framed honestly in interviews as demonstrative, not real management experience.

### Session 14 (2h) — Incident Postmortem
- Reproduce the captive-dependency bug from Session 3 (or another real bug you hit during the build) as a formal incident: timeline, impact (framed as if in production), root cause, fix, and — the part most candidates skip — the follow-up action items (what would prevent this class of bug next time: analyzer rule, code review checklist item from Session 12, etc.)

**Resources:** Google SRE postmortem template (public, widely used as a reference shape).

**Review:** What's the difference between a blameless postmortem and a blame-driven one? Why does that distinction matter for a manager?

### Session 15 (2h) — Roadmap + Estimation
- Write a 2-3 horizon roadmap for this "product" post-MVP (e.g., near: pagination + search; mid: multi-tenant; far: reporting/analytics). Tie each horizon to a rough user or business reason, not just "more features."
- Do a lightweight estimation pass on the sessions themselves in hindsight — where did actual time diverge from planned time, and why? This is real estimation-calibration data you can talk about.

**Review:** How would you explain a scope cut (e.g., "we're not doing multi-tenant this quarter") to a stakeholder who wants it? Practice the actual sentence.

### Session 16 (2h) — Hiring Loop + People-Process Sample
- Write a 5-8 question interview question set *derived from this codebase* — as if you were hiring for this team (e.g., "here's our Repository pattern usage, what would you ask a candidate about its tradeoffs?").
- Write one short 1:1/feedback-framework example — e.g., how you'd give feedback on the code-review checklist violations you found in Session 12 if they were a report's work, using a real framework (SBI: Situation-Behavior-Impact, or similar).

**Review:** What makes a good interview question versus a trivia question?

---

## Part D — Interview Narrative Packaging (new, ~4-6h)

### Session 17 (2h) — STAR Story Extraction
- Pull 3-4 STAR stories (Situation/Task/Action/Result) out of the ADRs, the postmortem, and the roadmap work — one per likely interview theme: a technical tradeoff decision, a "bug you found and fixed" story, a "how you'd explain a cut to a stakeholder" story, a "how you'd mentor" story.

### Session 18 (2h) — Extended Capstone (30-minute version)
- Extend the original Session 10 3-minute capstone into a 30-minute deep-dive: architecture walkthrough, then be ready to go one layer deeper into *any* piece on request — the DI lifetime bug, the ADR tradeoffs, the postmortem, the roadmap reasoning.
- Draft 8-10 anticipated follow-up questions (one per artifact) with answers, from memory, out loud — no notes, per the original plan's own review discipline.

**Final review (do this one seriously, no notes):** Deliver the 3-minute version cold. Then let someone (or yourself, recorded) pick any artifact at random and go 5 minutes deep on it. This is the actual interview simulation.

---

## Revised Pacing

- **Part A (technical spine):** ~20h — same pacing as original (2 sessions/day = 5 days, or 1/day = 2 weeks).
- **Part B (tech lead):** ~8-10h — 4-5 sessions.
- **Part C (EM):** ~8-10h — 4-5 sessions.
- **Part D (narrative):** ~4-6h — 2 sessions.
- **Total: ~40-46h**, roughly double the original 20h, matching the "expand proportionally" decision.

Parts B, C, and D can run in any order after Part A completes — they all draw on Part A's artifacts but don't depend on each other. Suggested default order is B → C → D since tech lead artifacts (ADRs) feed directly into the postmortem and roadmap reasoning in C.

## Artifact Checklist (what "done" looks like)

- [ ] 4-6 ADRs in `/docs/adr/`
- [ ] 1 short design doc (non-trivial feature)
- [ ] 1 code review checklist, applied to real commits with example comments
- [ ] 1 mentoring/onboarding note
- [ ] 1 incident postmortem (blameless format)
- [ ] 1 roadmap doc (2-3 horizons)
- [ ] 1 estimation-calibration note (planned vs. actual time)
- [ ] 1 hiring-loop question set (5-8 questions)
- [ ] 1 feedback-framework example (SBI or similar)
- [ ] 3-4 STAR stories
- [ ] 3-minute AND 30-minute capstone narratives, deliverable from memory
