# 30-Minute Deep-Dive & Anticipated Follow-Ups

Status: Active · Date: 2026-08-22 · Author: Prasadmallavalli · Satisfies: Story 6.3 (FR-13's 30-minute deep-dive and follow-up-question requirement)

This is a structure, not a script — a time-boxed outline plus prepared answers, the way a real 30-minute technical/leadership conversation actually goes: an opening, then following wherever the interviewer wants to go deeper, not a memorized monologue. Unlike the [3-minute capstone](capstone-3-minute.md) and the [STAR stories](star-stories.md), which are word-counted because they're meant to be said verbatim, this document is meant to be *known*, not recited — the content it points to already exists in those two documents and in the artifacts themselves. **Delivery mode:** cold, no notes, same as the capstone and STAR stories — the artifacts exist as a reference for *this document's own preparation*, not as something open on a screen during the actual conversation. Given this is the longest and highest-stakes of the three interview documents, it's also the one most worth a full unscripted run-through beforehand, ideally with someone else picking the follow-up questions rather than going in a known order.

**The nine questions below aren't a closed set.** They're the prepared, artifact-anchored ones — a real interviewer will ask things this document doesn't predict, and the right response to an unanticipated question is the same reasoning muscle these nine are meant to build, not panic that it wasn't on the list.

**How the follow-ups fit the 30 minutes:** they aren't a tenth block bolted onto the end. They're what actually happens *during* the 16-28 minute artifact-layer blocks below, the moment an interviewer stops the walkthrough to ask about one artifact specifically — which is the realistic shape of a real 30-minute conversation, not six clean, uninterrupted time-boxes. If every follow-up got asked, the conversation would run past 30 minutes; the time-box below is for the *walkthrough*, not a guarantee that all nine questions plus the walkthrough both fit inside it.

## The 30-minute structure

| Time | Section | What it draws on |
|---|---|---|
| 0-3 min | Open with the cold capstone | [3-minute capstone](capstone-3-minute.md), verbatim |
| 3-10 min | Architecture walkthrough, one layer deeper | Clean Architecture layering, DI lifetimes, the auth/CSRF flow, the frontend's stale-response guard pattern — same topics the capstone names, expanded with the concrete detail a technical interviewer would actually probe for |
| 10-16 min | The DI bug, full trace | [STAR story 2](star-stories.md), expanded with the real repro numbers and mechanism — this is the point in a 30-minute conversation where "I fired fifty requests and forty-eight failed" earns a genuine walkthrough, not a teaser |
| 16-22 min | The Tech Lead artifact layer | The 6 ADRs (pick 2-3 to go deep on based on what the interviewer reacts to — ADR-001's honesty about its own ceremony is usually the one that gets a follow-up), the design doc, the 15-item checklist, the mentoring note |
| 22-28 min | The EM artifact layer | The postmortem and the SBI example are explicitly demonstrative — both say so out loud, and so would I. The roadmap, the estimation note, and the hiring question set are *not* hypothetical the same way: they're real work product built from this project's actual gaps, commits, and findings. Only the first two need the "this is practice" caveat; the other three stand on their own. |
| 28-30 min | Close | Name what's left unexplored (Epic 6 itself — STAR stories, this deep-dive) and hand control back: "where do you want to go deeper?" |

**Why this ordering, if asked:** technical credibility first (the code actually works, here's the hardest bug), then the judgment layer built on top of it (the artifacts), because the artifacts only mean something once the interviewer has seen there's a real, working system underneath them — leading with the artifacts risks sounding like documentation for its own sake.

**Pacing check, not a word count:** six minutes across four or five artifacts each (16-22 and 22-28 min) is under 90 seconds per artifact if split evenly — unrealistic, and not the plan. The real plan is picking the one or two artifacts most likely to land for *this* interviewer (technical interviewer → the DI-lifetime ADR and the checklist; EM interviewer → the postmortem and the roadmap) and giving those real time, mentioning the rest in one sentence each rather than splitting evenly. As a sanity check against real material: STAR story 2 covers the DI bug's full arc in a verified 1.81 minutes on its own — so a 6-minute block covering four unrelated artifacts is plausible only if most of them get a sentence, not a story.

**Adapting to a single-track interview:** most real 30-minute loops are one interviewer, one track, not all three at once. For a purely technical round, compress or skip the 22-28 min EM block and extend the architecture/DI-bug blocks instead. For a purely EM round, compress the 16-22 min Tech Lead block to one or two ADRs and spend the reclaimed time on the postmortem and roadmap. The structure above is the all-tracks version; cutting it down, not stretching a missing track thin, is the right move when only one interviewer is in the room.

## Anticipated follow-up questions

Nine questions — one per Epic 4/5 artifact, the four Tech Lead artifacts plus the five EM artifacts, falling in the 8-10 range the AC sets. Each answer is prepared, not scripted: the actual content to hit, not a sentence to recite. Track tags below use the same labels as the [STAR stories](star-stories.md) document.

**1. The ADR set** *(technical/senior-IC track)* — "Which of your six ADRs would you push back on if a senior engineer challenged it?"
Repository + Unit of Work (ADR-001) — it's the most genuinely debatable one, and I said so in the ADR itself: at this project's size, injecting `AppDbContext` directly would have worked fine, and the abstraction's value here is forward-looking (testability, legibility) rather than solving a live problem. I'd defend it anyway on one concrete ground: the Moq-based unit tests already depend on that seam existing, so reversing it now isn't free — it's not "the pattern is obviously right," it's "the cost of reversing it is now higher than the cost of keeping it."

**2. The design doc** *(technical/senior-IC track)* — "Your pagination design is proposed, not built — why keyset over offset, and what's the real cost of that choice?"
Keyset pagination is an index seek regardless of depth and doesn't drift when rows are deleted mid-pagination, which offset does. The real cost, stated honestly in the doc: no "jump to page 47," only next/previous — a genuine product tradeoff I named up front rather than discovering under interview pressure.

**3. The code review checklist** *(tech lead track)* — "How did you decide what's a blocking finding versus a nit?"
Items 1-10 (architecture, data integrity, security) block a merge if newly violated; items 11-14 (testing, frontend resilience, doc accuracy) are strong-should, flagged but not automatically blocking; item 15 is process — anything real that isn't fixed inline goes to a tracked ledger with a source and evidence, not into a conversation that evaporates.

**4. The mentoring note** *(tech lead track)* — "What's the difference between explaining something to unblock someone versus teaching them the underlying principle?"
Unblocking gives the fix for the thing in front of them right now. Teaching gives the reasoning that generalizes to the next case I never explicitly covered — which is why the DI-lifetime warning in the mentoring note doesn't just say "use Scoped here," it walks through the actual captive-dependency bug, with real numbers, so the engineer can recognize the *shape* of the mistake somewhere else, not just avoid this one line.

**5. The postmortem** *(technical + EM crossover track)* — "What's the difference between a blameless postmortem and a blame-driven one, and why does that distinction matter for a manager?"
A blame-driven postmortem makes the person who touched the code defensive, which makes them more likely to hide the next problem, not less. A blameless one assigns cause to the system and process — nothing caught this misregistration before a load test went looking for it — and routes the energy into a guardrail (`ValidateOnBuild`) that protects the *next* engineer, including the same one, from the same mistake. The manager's job in the room is keeping the conversation pointed at the guardrail, not at the person.

**6. The roadmap** *(EM track)* — "How would you explain a scope or sequencing call to a stakeholder who'd push back on it?"
The roadmap's Horizon 3 sequencing note makes the underlying case (ranking a low-visibility horizon last isn't the same as saying it should be built last) — the actual sentence I'd say out loud is the one I wrote for [STAR story 3](star-stories.md), grounded in that same note: "I ranked this last because users won't see it directly — but building it first is what keeps the things users *do* see from breaking when we ship them. I wanted you deciding with that tradeoff in front of you, not guessing from the order I listed things in."

**7. The estimation note** *(EM track)* — "Knowing what you know now, what would you do differently in how you planned this?"
Two concrete things, not a vague "communicate better": start version control on day one, not partway through — I lost the timestamp trail for roughly a third of the planned work because git wasn't initialized yet; and budget review cycles per artifact instead of hours per topic, since findings-per-artifact turned out to be the more trackable, explicable unit across this whole build, even though it wasn't perfectly stable either.

**8. The hiring question set** *(EM track)* — "What makes a good interview question versus a trivia question, and why only eight?"
A trivia question has exactly one correct answer a candidate either knows or doesn't. A judgment question hands them a real decision this project actually made, with its real tradeoff, and listens for how they reason about it — there's no single right answer, only a better- or worse-reasoned one. Every question in the set is built the second way on purpose. On the count: eight was the range's floor, not a hard limit reached by running out of material — the document itself names two more real, sourced candidates (missing controller-level test coverage, inaccurate OpenAPI metadata) that would've made equally legitimate ninth and tenth questions, left out deliberately rather than padded in just to hit a bigger number.

**9. The SBI feedback example** *(EM track)* — "Walk me through how you'd actually deliver that feedback, not just recite the framework."
Consent first — ask if it's a good time, don't lead with the finding cold. Situation, Behavior, and Impact each stay in their lane: Situation doesn't editorialize, Behavior is stated as a fact a camera could've recorded, Impact separates the measured number from any hypothetical extrapolation, out loud, so I'm not overstating it. Then I stop talking and listen, because the right next move depends entirely on what they say back — and I've got three different real branches prepared for three different things they might say, not just one assumed reaction.

## Two questions about the process itself, not tied to one artifact

These aren't part of the nine above — they're not about a specific artifact, they're about the credibility of the whole exercise, and they're the two an interviewer is most likely to actually ask.

**"Who actually reviewed all this — was it a real second person?"** No. This was built solo, with an AI agent running adversarial review passes against each artifact — genuinely finding real errors (wrong citations, factual overclaims, timing miscalculations, an artifact sourced from the wrong epic) that got fixed before anything shipped, not a rubber stamp. That's a real, specific claim I can back up with examples on request, not "it was reviewed" as a vague credibility gesture — and I'd say the limitation plainly too: it's not the same as an independent human engineer pushing back in real time.

**"Isn't the flagship bug staged — you caused it on purpose?"** Yes, and I'd say that before they finished asking, the same way [STAR story 2](star-stories.md) and [the postmortem](../eng-mgmt/postmortem-di-captive-dependency.md) both say it up front. The mechanism, the failure, and the fix are all real and log-verified; the *scenario* that produced them was deliberate, because the alternative was writing a hypothetical incident with invented numbers, which is worse interview material, not more honest material.
