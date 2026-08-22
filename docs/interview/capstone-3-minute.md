# 3-Minute Cold Capstone Walkthrough

Status: Active · Date: 2026-08-22 · Author: Prasadmallavalli · Satisfies: Story 6.2 (FR-13's 3-minute capstone requirement)

Delivered cold — no notes, no artifact in front of me — in response to "walk me through this project" or "tell me about something you built recently." **Verification:** word-counted below against 145 words/minute, on the trimmed-and-rebalanced version below (see the note on the first draft's imbalance at the end).

## The walkthrough

"This is a full-stack product catalog — ASP.NET Core Web API, EF Core against a real MSSQL instance, React frontend — but the code isn't really the point. The point is that everything in it traces back to a real decision, a real bug, or a real review finding, because I built it to have honest answers under a senior, tech-lead, or EM interview loop, not generic ones.

The build goes in layers. First, the application itself: Clean Architecture — Domain, Application, Infrastructure, Api — repository and unit-of-work patterns, DTOs that never leak a domain entity across the boundary, correlation-ID logging on every request so failures are traceable after the fact, and a real unit test suite that has to stay green. Then auth: registration, JWT login held in an httpOnly cookie specifically to block XSS, and CSRF protection to close the hole that decision reopens. Then the React frontend: full create-read-update-delete, with a stale-response guard pattern I built once during list-view work and reused across most of the places a component fetches and a slower response could land after a newer one — most, not all, and I'd flag the one gap if asked.

The story I'd lead with: I deliberately caused a dependency-injection bug on a single-view app where this one endpoint is the entire product — registered a repository app-lifetime-long instead of request-scoped, fired fifty concurrent requests at it, forty-eight failed. Fixed it, reran clean twice, then added a startup check so that mistake now fails loudly at boot instead of waiting for a load test to find it. I've got a full two-minute version of that story ready if you want the trace.

On top of the application sits the layer a tech lead or EM actually produces: six architecture decision records naming real rejected alternatives, a scaling design doc, a fifteen-item review checklist applied to my own commits, and a mentoring note — plus, on the EM side, a roadmap, an estimation-calibration note, and hiring questions, all real work product grounded in this project's actual gaps and commits, and two pieces I'll say honestly are practice, not real management history: the postmortem, since the incident was deliberately caused, and the feedback example, since I don't have a real report to have given that feedback to.

I've also got three or four STAR stories and a thirty-minute deep-dive ready — happy to go wherever's most useful."

## Word-count verification

Counted programmatically: 400 words in the walkthrough text (excluding headers and this section) ÷ 145 words/minute ≈ 2.76 minutes — under the "approximately 3 minutes" target with real margin, leaving room for a genuinely unrehearsed delivery (breath pauses, slower spoken pace on the em-dash asides) to still land inside 3 minutes rather than needing to hit a flat-rate estimate exactly. Per-paragraph balance, also counted rather than eyeballed: hook 17%, technical spine 32%, the DI-bug teaser 20%, the artifact layer 26%, close 5% — no single section dominates the way the first draft's did. (Recounted during Epic 6's retrospective after two corrections — the artifact-layer paragraph's overclaimed EM framing, and the frontend paragraph's overclaimed "everywhere" on the stale-response guard, contradicted by the mentoring note's own documented `AuthContext` gap. Both fixes together added 34 words; timing and balance still hold with real margin.)

The first draft measured 416 words (2.87 min, ~8 seconds of margin) and was unbalanced — the DI-bug paragraph alone was 36% of the piece and the actual application got one 50-word sentence, despite the AC requiring end-to-end coverage. This version trims the bug to a compact teaser (pointing to the full STAR-story version instead of re-narrating it) and spends the reclaimed words on the parts of the project — testing, logging, auth, the frontend resilience pattern, the design doc, the estimation note — the first draft skipped entirely.
