# STAR Stories

Status: Active · Date: 2026-08-22 · Author: Prasadmallavalli · Satisfies: Story 6.1 (FR-12's STAR-story requirement)

Four stories (Situation/Task/Action/Result), each sourced from one specific Epic 4 or 5 artifact — a tradeoff decision, the postmortem, a stakeholder-communication moment, and a mentoring moment, the four categories `epics.md`'s Story 6.1 AC names exactly. Each is written to be said out loud, not read — contractions, short sentences, no code-identifier walls a mouth would trip over. **Verification:** word-counted below (excluding the Cue/Source line and the STAR labels) against 145 words/minute, a middle-of-the-road spoken pace; every story lands between 1.6 and 1.8 minutes, with real but not generous headroom under the 2-minute cap — see the Word-count verification table at the end for the exact numbers and how they were checked.

**How this connects to the rest of Epic 6:** these four source artifacts are the same ones Story 6.3's anticipated-follow-up-question set will draw on — expect direct overlap, not coincidence. The 3-minute cold capstone (Story 6.2) isn't these four stories back to back; it's a separate, shorter narrative these stories zoom into when an interviewer asks a specific "tell me about a time" question rather than "walk me through the project."

## 1. The tradeoff decision — httpOnly cookies, and what they cost *(technical/senior-IC track)*

**Cue:** "Tell me about a security tradeoff you made and what it cost you." **Source:** [ADR-003](../adr/003-httponly-cookie-token-storage.md), httpOnly cookie vs. localStorage.

**Situation:** Building the login flow, I had to decide how the frontend would hold onto the session token — store it in the browser's local storage and attach it by hand to every request, or let the browser hold it in a cookie the server marks as script-inaccessible.

**Task:** Pick a strategy and be ready to defend the tradeoff, not just point at "best practice."

**Action:** I went with the script-inaccessible cookie, because local storage is readable by any script running on the page — including an injected attack script — while the cookie option simply isn't visible to JavaScript at all. But I didn't stop at "cookies are safer." That kind of cookie gets sent automatically on every request, which opens a *different* hole — a request-forgery risk a manually-attached token never had. So closing the first hole meant I now owed the system a second, separate defense, which became its own piece of work later: an anti-forgery token on every request that changes data.

**Result:** The login flow resists the first attack by construction, and the hole it reopened is closed by a dedicated, documented control — not an accident nobody noticed. The line I'd lead with: almost no security decision eliminates risk, it trades one kind for another, and the job is naming the new risk out loud before someone else finds it for you.

## 2. The bug — a captive dependency, deliberately caused *(technical + EM crossover track)*

**Cue:** "Walk me through a bug you found and fixed." (EM-track pushback to expect: "was this really a severity-one?" — see the Result.) **Source:** Story 1.5's DI captive-dependency bug — [ADR-006](../adr/006-scoped-di-lifetimes.md) and [the blameless postmortem](../eng-mgmt/postmortem-di-captive-dependency.md).

**Situation:** Upfront, since I'd say this in the actual interview too: this wasn't a real production outage — it's a bug I deliberately caused on purpose, to have a genuine incident to write an honest postmortem about instead of a hypothetical one.

**Task:** Misregister a dependency's lifetime the way a real engineer plausibly could, watch it actually fail under load, then root-cause and fix it for real.

**Action:** I registered one repository as app-lifetime-long when it should've been request-scoped, while it still held a database connection that's request-scoped by design — a captive dependency: the first request grabs the connection, every later one is stuck reusing it, and that connection object isn't thread-safe. I fired fifty requests at it at once. Forty-eight failed. I fixed the registration and reran the same burst twice — fifty clean successes both times.

**Result:** A real, log-verified failure with stack traces, not a made-up example — plus a guardrail I added afterward so this exact mistake now fails loudly the moment the app starts, instead of waiting for a load test to find it. Two things I'd have ready if pushed: "was this really severity-one" — fair, since it never touched real users, but forty-eight of fifty failing, framed as production traffic, *is* a near-total outage of the one thing this app does; and "why exactly forty-eight, not fifty" — the two that succeeded just happened to not overlap in time on the shared connection, which is the whole problem: it's a race, not a deterministic failure.

## 3. The stakeholder conversation — naming a hidden tradeoff instead of smoothing it over *(EM track)*

**Cue:** "How would you explain a prioritization call to a stakeholder who'd push back on it?" **Source:** [the post-MVP roadmap](../eng-mgmt/post-mvp-roadmap.md)'s Horizon 3 sequencing note.

**Situation:** Writing the post-MVP roadmap, I ranked three horizons by how soon a real user would notice if each one were skipped — and the CI-pipeline-and-safety-net horizon landed last, because it's invisible to a user by definition.

**Task:** A stakeholder skimming that ranking could reasonably read "ranked last" as "build it last" — and that's not actually the right call, so I had to say so before they asked.

**Action:** I wrote the tension into the roadmap directly instead of letting the ordering imply something I didn't mean: ranking that horizon last by user-visibility isn't the same as saying it should be *built* last. A CI pipeline and a regression test for the bug from story two above are exactly the kind of investment that lowers the risk of everything else — shipping a bigger feature with no safety net under it is riskier than shipping it with one already in place.

**Result:** The stakeholder gets the real tradeoff instead of a false read of the ordering. The sentence I'd actually say: "I ranked this last because users won't see it — but building it first is what keeps the things users *do* see from breaking when we ship them. Your call on sequencing, but I wanted you deciding with that in front of you, not guessing from the order I listed things in."

## 4. The mentoring moment — teaching a pattern without teaching dogma *(tech lead track)*

**Cue:** "Tell me about a time you mentored someone through a technical decision." **Source:** [ADR-001](../adr/001-repository-and-unit-of-work.md) and [the mentoring note](../onboarding/mentoring-note.md)'s Repository/Unit-of-Work explanation.

**Situation:** A mid-level engineer joining this codebase would see every database call routed through a Repository layer and could reasonably wonder if that's real architecture or just ceremony.

**Task:** Explain why it's there in a way that builds their judgment, not just their compliance — without pretending the layer is free.

**Action:** I wrote the explanation the way I'd actually say it out loud: these interfaces are narrow and shaped around what actually calls them, not a generic one-size-fits-any-entity interface — we considered that and turned it down. The bigger reason it's there is that our services depend on an abstraction, never on the database library directly, which is what lets us test the business logic without spinning up a real database. Then I said the harder part out loud too, in the same document, not just in conversation: at this project's actual size, skipping the layer and injecting the database context directly would have worked fine. The payoff here is testability and clarity, not solving a scaling problem we don't have yet.

**Result:** A mentoring note that teaches the pattern *and* teaches when to question it — the difference between an engineer who reaches for this layer everywhere because "that's the standard" and one who can say why it's earning its keep here, and would notice the one time it wasn't.

## Word-count verification

Counted programmatically (word count of each story's body, excluding the Cue/Source line and the STAR labels themselves) — not eyeballed, per this project's own verify-don't-assert convention:

| Story | Words (excl. labels/Cue/Source) | Est. time @ 145 wpm |
|---|---|---|
| 1 — httpOnly cookies | 236 | 1.63 min |
| 2 — the DI bug | 262 | 1.81 min |
| 3 — the roadmap tradeoff | 235 | 1.62 min |
| 4 — the mentoring moment | 231 | 1.59 min |

All four sit under the 2-minute cap, though with the least margin on story 2 — it carries the most required content (the up-front honesty disclosure plus two prepared fallbacks) and is the one worth the most rehearsal before relying on it live. The first draft of story 2, before trimming during review, measured 297 words (2.05 minutes) — over the cap; this table reflects the trimmed version actually delivered above, not the original estimate.
