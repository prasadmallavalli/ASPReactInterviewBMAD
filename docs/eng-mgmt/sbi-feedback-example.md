# Feedback Framework Example: SBI (Situation-Behavior-Impact)

Status: Active · Date: 2026-08-22 · Author: Prasadmallavalli · Satisfies: Story 5.5 (FR-11's SBI requirement, grounded in Story 4.3's checklist Item 3)

**Framing note, matching the postmortem's own convention:** the finding below is real — the Story 1.5 DI captive-dependency bug, documented in [ADR-006](../adr/006-scoped-di-lifetimes.md), [the code review checklist](code-review-checklist.md) (Item 3), and [the saved reproduction log](../../_bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md) with the actual correlation IDs and stack traces this example's Behavior/Impact lines are built from. The *feedback conversation* is a demonstrative exercise: this project has one builder, not a report to actually give this feedback to. It's written as if delivered to an engineer who wrote the misregistration, because that's the exercise the brief's addendum asks for directly — practicing the actual sentences, not just describing the framework. There's no real pull request behind this exercise either — the bug and its fix predate this repo's `git init`, so the script below is grounded in the saved log, not a PR link, the same limitation the checklist's own Item 3 names honestly.

## What SBI is, briefly

Situation-Behavior-Impact (commonly attributed to the Center for Creative Leadership) structures feedback into three deliberately separated parts: **Situation** — the specific context, so it's clear which instance is being discussed, not a pattern the person has to guess at; **Behavior** — the observable action itself, stated as a fact a camera could have recorded, not an inference about intent or character; **Impact** — the actual, concrete effect that behavior had, stated as specifically as the evidence allows. The discipline is keeping each part in its lane: Situation doesn't editorialize, Behavior doesn't diagnose motive, and Impact doesn't inflate a measured fact into an unlabeled hypothetical.

## Why SBI, not "good job" or "this is wrong"

"You were careless with the DI registration" is a character judgment; it's also unfalsifiable and hard to act on. "You registered `IProductRepository` as `AddSingleton` in this line, and that caused 48 of 50 concurrent requests to fail" is a specific, verifiable claim the other person can either confirm or correct, and it points at exactly one thing to change next time. The same discipline that makes the postmortem blameless (assign cause to the change, not the person) is what makes SBI feedback usable instead of just uncomfortable.

## Context for this example

**Relationship:** written as a tech lead giving feedback to an engineer on their own team, one-on-one — not a peer-to-peer conversation and not a formal performance-review moment. That matters here specifically because a tech lead has both the standing to raise a technical finding directly and the responsibility to make sure the guardrail (not just the conversation) is what actually prevents a repeat, which shapes the close below.

**Venue:** synchronous, live (in person or a call), not an async written note. A finding with real measured impact (48/50 failures) benefits from a conversation where tone and follow-up questions can happen in real time — a written note risks reading as more severe than intended, with no way to soften it or answer a clarifying question in the moment. A smaller, less consequential finding might reasonably go async instead.

**Sequencing relative to Story 5.1's postmortem:** this conversation happens *before* the blameless postmortem is shared more broadly, not after. Blameless framing works because the postmortem assigns cause to systems and process for an audience that wasn't necessarily in the room for the original decision — but the engineer who wrote the line already knows it was them, so a private, specific conversation first (this document) means they hear the concrete "this is what happened and here's what we're changing" from a person, not for the first time in a document circulated to the wider team.

## The conversation

**Opening, setting context and consent — not leading with the finding cold:**

> "Do you have 15 minutes sometime today or tomorrow? I want to walk through the concurrency issue we hit on the product listing endpoint on Wednesday — not a callout, I want to understand your thinking and make sure we're both walking away with the same lesson from it."

*If they can't do it today, or seem caught off guard by the ask itself:* that's a real signal, not friction to push through — "No rush, whenever works for you this week" costs nothing and the finding isn't time-sensitive (it's already fixed). Forcing the conversation into a moment where someone's guard is already up tends to produce defensiveness, not the specific understanding SBI is trying to build.

**Situation — when and where, specific enough to be unambiguous:**

> "When we registered `ProductRepository` in `Program.cs`, and then load-tested it with 50 concurrent requests against `/api/products`."

**Behavior — the exact, observable action, no adjectives:**

> "`IProductRepository` got registered with `AddSingleton` instead of `AddScoped`. `ProductRepository` depends on `AppDbContext`, which is registered `Scoped` — so that one line made the repository, and the database context it holds, live for the entire lifetime of the app instead of one request at a time."

**Impact — the measured fact, kept separate from the extrapolation:**

> "When we ran the 50-request burst, 48 failed with `InvalidOperationException` — EF Core detected multiple requests trying to use the same `DbContext` concurrently and threw rather than silently corrupting data. That's the measured result: 48 of 50, a 96% failure rate under that load."
>
> "Here's the part that's a judgment call, not a measurement, and I want to be clear about the difference: if this had reached real concurrent traffic instead of a controlled load test, my read is it would have looked like a near-total outage of the only content view this app has — but that's my extrapolation from the 96% figure, not something we directly observed in production, because it never got there."

**Pause here — this is the part a script can't fully script:** a real SBI conversation stops after Impact and listens. Three ways this could actually go, and each one changes what comes next:

- *"I didn't realize `AddSingleton` would capture a Scoped dependency transitively."* → This is a gap in understanding DI container mechanics specifically, not judgment — the next move is concrete and low-stakes: point them at ADR-006's account of *why* the container doesn't stop you from doing this, maybe pair on the fix for the next one together.
- *"I copied that pattern from somewhere else in the codebase without checking the lifetime."* → This is about verification habits under time pressure, not knowledge — worth naming directly ("what would make you check that before it goes out, not after?") rather than re-explaining DI lifetimes they may already understand in the abstract.
- *"I knew it captured a dependency, I didn't realize this specific repository held a DbContext."* → This is the hardest one to hear, because it's closer to "I checked, and checked wrong" than "I didn't check" — worth resisting the urge to relitigate whether they *should* have known, and instead asking what would have made that specific fact more visible at the point of writing the line.

**Disagreement or pushback is a real possibility, not a script failure:** if they push back on whether the reproduction's load pattern is realistic, or say "this would never happen with our actual traffic" — that's worth taking seriously and checking, not overriding. The honest answer here is that this specific reproduction *was* a deliberate load test built to surface the failure mode, not organic production traffic — a fair pushback deserves that acknowledgment, followed by redirecting to the actual point: the mechanism is real regardless of how the load was generated, and the guardrail now catches the registration mistake at startup, before any traffic pattern (deliberate or organic) could trigger it.

**Forward-looking close, tied to what actually happened next in this project:**

> "Here's what we actually did about it: we added `ValidateScopes`/`ValidateOnBuild` outside Development too, so this exact class of mistake — something that holds a Scoped dependency getting registered longer-lived — now fails at startup instead of waiting for someone to load-test it. That's not a fix aimed at you personally, it's a guardrail for the next person, including future-you. What would help you catch this kind of thing before it needs a guardrail to catch it for you?"

**Closing the loop, after the conversation ends:** a short written follow-up — two or three lines, not a formal document — confirming what was discussed and agreed, sent the same day. Something as simple as "thanks for talking through the DI registration issue — appreciate you walking me through your thinking. To confirm what we landed on: [whichever branch above actually happened]. The `ValidateOnBuild` guardrail is already in from our side." This isn't bureaucracy for its own sake — SBI conversations happen in the moment, and a brief written record means neither person is relying on memory for what was actually agreed if it comes up again later.

## Why this example, not a different Story 4.3 finding

The checklist has other real, still-open findings (the check-then-act race, missing controller-level test coverage) that could ground an SBI example just as legitimately. This one was chosen because it has the richest evidence trail — an exact line, a measured before/after (48/50 failing, 50/50 passing), and a real follow-up action already taken — which is what makes the Situation and Impact sections concrete instead of hand-wavy. A vaguer finding would force this example to fall back on hedging language ("this could have caused issues"), which defeats the point of practicing SBI on real material.

**Deliberately not duplicating [Story 5.1's postmortem](postmortem-di-captive-dependency.md):** the postmortem's follow-up actions are process/systems-facing — a guardrail, a still-missing regression test, still-missing alerting. This document is a person-facing conversation about the same underlying finding, happening first (see Context above). Both are grounded in the same bug because a real DI-lifetime bug produces both kinds of follow-up in a real team — a systems fix *and* a conversation with whoever wrote the line — and treating them as substitutes for each other would be a real gap in either direction: a guardrail without ever discussing it with the person who can avoid triggering it again, or a conversation with no guardrail behind it in case the lesson doesn't fully land.
