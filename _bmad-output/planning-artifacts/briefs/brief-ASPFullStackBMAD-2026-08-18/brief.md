---
title: "ASP.NET Core Full-Stack: Senior Developer / Tech Lead / EM Portfolio Project"
status: draft
created: 2026-08-18
updated: 2026-08-18
---

## Executive Summary

This is a self-directed build: a clean, testable ASP.NET Core Web API + EF Core/MSSQL + React CRUD application, extended past its original 20-hour "learn the syntax" scope into a portfolio piece that demonstrates 15+ years of engineering judgment — not just working code. The original plan (Sessions 1–10, ~20 hours) covers the technical 80%: API fundamentals, EF Core, DI, SOLID, patterns, DTOs/validation, JWT auth, a React frontend, full CRUD integration, and basic testing. That stays as the technical spine.

What's new is a second layer wrapped around the same build: the artifacts and decisions a senior engineer, tech lead, or engineering manager actually produces — ADRs, design docs, code review standards, incident postmortems, roadmapping, hiring-loop materials, 1:1/feedback frameworks — plus interview-narrative packaging (STAR stories) that ties every decision back to a defensible "why." The deliverable isn't just an app; it's an app plus the paper trail a senior/lead/EM candidate would produce building it, ready to walk an interviewer through in under 3 minutes or defend for 30.

## The Problem

The original 20-hour plan proves you can *build* a CRUD app — routing, EF Core, DI, one pattern, one auth flow. That's enough to pass a mid-level screen. It is not enough for senior/staff, tech lead, or EM interviews, where the real questions are: *Why this pattern and not that one? How would this scale? How did you review your team's code on this? What broke in production and what did you do? How did you plan the roadmap? How would you explain a scope cut to a stakeholder?*

A candidate with only the working code has no answer to those — the artifacts that prove judgment (ADRs, postmortems, review standards, roadmaps) don't exist because the original plan never asked for them. Building code without narrating the reasoning behind it, out loud, from memory, is exactly the gap that sinks senior-level interviews even when the code itself is fine.

## The Solution

Keep the original 10-session technical build intact as the foundation, then layer three additional tracks on top of the same codebase and timeline:

1. **Advanced technical depth** — added to the existing sessions, not bolted on separately: system design tradeoffs, scalability/caching, observability (structured logging, correlation IDs), security hardening beyond JWT basics, performance profiling, resilience patterns (retry/circuit breaker).
2. **Tech lead artifacts** — ADRs for the real decisions made during the build (why Repository/UoW, why this auth flow), a short design doc for one non-trivial feature, a code review checklist applied to the codebase, mentoring notes written as if explaining each SOLID/pattern choice to a mid-level engineer.
3. **Engineering manager artifacts** — a roadmap for how this "product" would grow post-MVP, a rough estimation/sizing exercise for the sessions themselves, a 1-page incident postmortem for a deliberately-injected bug, a sample interview-loop question set derived from the codebase, a stakeholder-communication example (explaining a scope cut in plain language).
4. **Interview-narrative packaging** — STAR-format stories extracted from #2 and #3, plus the existing Session 10 "walk me through your architecture in 3 minutes" capstone extended into a 30-minute deep-dive version and a set of anticipated follow-up questions with answers.

Every code file produced carries comments that explain *why*, not *what* — the non-obvious constraint or tradeoff behind a decision, written the way a senior engineer annotates code for a teammate, not a tutorial.

## What Makes This Different

The original plan is a well-sequenced technical curriculum; plenty of those exist. What's different here is that the *artifacts of seniority* are treated as first-class deliverables with the same rigor as the code — not an afterthought "prep some interview answers" bullet at the end. Each leadership artifact is tied to a real decision made in the actual build (the ADR explains an actual choice, the postmortem covers an actual injected bug), so nothing is fabricated or generic. The honest tradeoff: this roughly doubles the time investment (35–50h vs. 20h) in exchange for interview-defensibility across three role types instead of one.

## Who This Serves

**Primary:** the builder (Prasad) — preparing for interview loops that could land as senior developer, tech lead, or engineering manager, and wants one project that flexes to whichever room he's in.

**Secondary (implicit audience):** the interviewer/hiring panel on the other side of that conversation — every artifact should be legible and credible to someone who didn't watch it get built.

## Success Criteria

- The Session 10-style capstone review can be delivered from memory in under 3 minutes (as originally scoped) **and** sustained for a 30-minute technical deep-dive without the story falling apart.
- Every added artifact (ADR, postmortem, roadmap, review checklist, hiring question set) is traceable to something that actually happened in the build — no generic filler.
- The candidate can credibly answer at least one question from each of the three interview tracks (senior IC, tech lead, EM) using this project as the anchor.
- Code is functionally complete per the original CRUD scope (Sessions 1–9) and passes its own test suite (Session 10).

## Scope

**In:**

- Full technical build from the original plan (Sessions 1–10), unchanged as the spine.
- Advanced technical topics layered onto the existing sessions (see addendum for session-by-session mapping).
- One ADR per major architectural decision (target: 4–6 ADRs).
- One short design doc for a single non-trivial feature.
- One code review checklist, applied and shown against real commits.
- One roadmap doc (post-MVP direction, 2–3 horizon).
- One incident postmortem (deliberately injected + fixed bug).
- One sample hiring-loop question set (5–8 questions) derived from the codebase.
- STAR-story extraction + extended capstone narrative.

**Out (explicitly, per the original plan's own exclusions plus new ones):**

- Advanced EF Core internals, SignalR/gRPC/Hangfire, Redux/NgRx-scale state management, Docker/K8s deployment, full Gang-of-Four catalog — unchanged from the original plan.
- Real production incident (the postmortem uses a deliberately injected bug, not a live outage).
- Actual team management (no real reports) — EM artifacts are demonstrative, framed honestly as such in interviews, not claimed as real management experience.
- A second framework track (Angular) — stays React per the original plan's reasoning; noted as swappable.

## Vision

If this works, the same pattern — technical build + traceable leadership artifacts — becomes reusable scaffolding for the next stack or role level, not a one-off. In 2–3 years, this project (or its successor) is the anchor story in any interview loop across IC, lead, or manager tracks, updated incrementally rather than rebuilt from scratch each job search.
