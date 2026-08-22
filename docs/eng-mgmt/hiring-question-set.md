# Hiring-Loop Question Set

Status: Active · Date: 2026-08-22 · Author: Prasadmallavalli

Eight questions, each built from a real artifact or code decision in this repo — not generic trivia. A trivia question has one correct answer a candidate either knows or doesn't ("what does `AddScoped` do?"). A judgment question hands the candidate a real decision this project actually made, with its real tradeoff, and listens for how they reason about it — there's no single "correct" answer, only a better- or worse-reasoned one. Every question below is built the second way: it starts from a real snippet or finding, not an abstract concept.

**How to use these in an actual loop:** these eight aren't meant for one candidate in one sitting — they span backend architecture (1, 2, 5, 6), security (3), frontend internals (7), and pure engineering judgment (4, 8), which in a real loop would split across at least two interviewers/rounds (a backend-focused round: 1, 2, 5, 6; a full-stack or security-and-judgment round: 3, 4, 7, 8). Each is scoped for roughly 10-15 minutes including the follow-up, so a 4-question round fits a 45-60 minute slot. **"What a strong answer covers" is deliberately a set of signals to listen for, not a script to read from** — a full model answer for each would turn the interviewer into someone grading against a rubric instead of listening for reasoning, which is the opposite of what these questions are built to test. Each question also carries a **Follow-up if shallow** — what to ask next if the first answer only restates the obvious part.

## 1. Repository/Unit-of-Work — when is the abstraction worth it? *(backend, mid-to-senior)*

**Show them:** [ADR-001](../adr/001-repository-and-unit-of-work.md)'s Alternatives section, which considers injecting `AppDbContext` directly and admits "a real but narrow benefit, not evidence the pattern was strictly necessary" before rejecting it anyway — and its Consequences section, which states outright that at this project's scale the abstraction's "value is mostly forward-looking (testability, interview legibility) rather than solving a live pain point."

**Ask:** "We chose Repository + Unit of Work here, but the ADR itself says the alternative would have worked. Was that the right call? What would make you flip your answer?"

**What a strong answer covers:** recognizes this isn't a "always use Repository" vs. "never use Repository" question — it's about naming the actual variable that should decide it (team size, test strategy, likelihood of swapping the ORM, how many entities exist). A weak answer recites "Repository is a best practice" without engaging the ADR's own honesty about the tradeoff being real, not obviously won.

**Follow-up if shallow:** "The ADR says the Moq-based unit tests now depend on this abstraction existing. Does that change your answer, or is that a sunk cost?"

## 2. The check-then-act race — a real, still-open bug *(backend, mid-to-senior)*

**Show them:** [`CategoryService.DeleteAsync`](../../src/Application/Services/CategoryService.cs) — `HasProductsAsync` check, then delete — and [ADR-005](../adr/005-category-delete-conflict-no-cascade.md)'s Consequences, which admits the race surfaces as an unhandled 500 instead of a clean 409 in a narrow window.

**Ask:** "Walk me through what happens if a Product insert lands between the `HasProductsAsync` check and the delete committing. Then tell me why we haven't fixed it."

**What a strong answer covers:** correctly traces the race, proposes the real fix (a Domain-level exception type Infrastructure translates, since Application can't catch `DbUpdateException` under AD-2's layering rule), and — the harder part — can articulate why *not* fixing it yet was a defensible call (narrow window, low real-world likelihood, logged and tracked rather than silently ignored) instead of treating every open bug as an automatic five-alarm fire.

**Follow-up if shallow:** "Why can't `CategoryService` just catch the `DbUpdateException` and return a 409 directly?" (tests whether they connect this back to AD-2's layering rule, not just pattern-match "catch the exception.")

## 3. httpOnly cookie vs. localStorage — the tradeoff that reopened a different hole *(full-stack/security)*

**Show them:** [ADR-003](../adr/003-httponly-cookie-token-storage.md) — the decision to store the JWT in an `httpOnly` cookie specifically to close XSS token theft.

**Ask:** "We picked httpOnly cookies over localStorage specifically to stop XSS token theft. What did that decision cost us, and how did we pay for it?"

**What a strong answer covers:** identifies that an `httpOnly` cookie is sent automatically on every request, reopening CSRF exposure a manually-attached bearer token wouldn't have — and can name that this project closed the reopened gap with a separate CSRF/anti-forgery token mechanism (Story 2.3), not by picking a different storage strategy. Tests whether a candidate sees security decisions as trading one risk for another, not eliminating risk outright.

**Follow-up if shallow:** "If httpOnly cookies still leave us exposed to CSRF, why not just go back to localStorage and accept the XSS risk instead?" (listens for whether they can compare the two risk profiles, not just recite that "CSRF exists.")

## 4. Validation composability — why `[Required]` isn't enough *(backend, any level)*

**Show them:** [`CategoryRequestDto.Name`](../../src/Application/DTOs/CategoryRequestDto.cs) — `[Required][StringLength(200)]` — and the real, still-open gap in [ADR-004](../adr/004-data-annotations-validation.md): a whitespace-only name passes validation today.

**Ask:** "This field is `[Required]`. Someone submits `\"   \"` as the name. What happens, and is that a bug?"

**What a strong answer covers:** correctly predicts it passes validation (since `[Required]` only rejects null/empty), identifies that's a real gap, and can name at least one way to close it (a trim-and-recheck step, or a custom `ValidationAttribute`) — while recognizing this specific gap is also evidence for a broader point: Data Annotations don't compose past simple per-property checks, which is exactly why ADR-004 flags this as the framework's real limit, not an oversight.

**Follow-up if shallow:** "This same gap exists on `ProductRequestDto.Name` too. Would you fix both the same way, or is there a case for handling them differently?"

## 5. DI lifetimes — the bug this project deliberately caused *(backend, any level)*

**Show them:** the Story 1.5 reproduction — `IProductRepository` registered `AddSingleton` while depending on a `Scoped` `AppDbContext`, 48 of 50 concurrent requests failing — full account in [ADR-006](../adr/006-scoped-di-lifetimes.md).

**Ask:** "If I registered a repository as Singleton while it depends on a Scoped `DbContext`, what breaks, and why does it only show up under load?"

**What a strong answer covers:** names the captive-dependency mechanism (the first request's `DbContext` gets captured and reused forever), explains why it's silent at low traffic (a single sequential caller never triggers the concurrency conflict), and — the differentiator — can describe how they'd *prevent* this class of bug going forward, not just detect it after the fact (this project's actual answer: `ValidateScopes`/`ValidateOnBuild` enabled outside Development, closing the exact gap that let this run silently under `ASPNETCORE_ENVIRONMENT=Production`).

**Follow-up if shallow:** "We caught this with a deliberate load test, not in normal use. What's a cheaper, earlier check that would have caught the misregistration before anyone had to run 50 concurrent requests at it?" (listens for `ValidateOnBuild`/`ValidateScopes` specifically, or an equivalent startup-time check, not just "write more tests.")

## 6. Manual DTO mapping vs. AutoMapper — what compiler safety actually buys you *(backend, any level)*

**Show them:** [ADR-002](../adr/002-manual-dto-mapping.md) — hand-written `ToDto()`/`ToEntity()`/`ApplyTo()` extension methods instead of AutoMapper, plus the concrete fact that `UserMapper.ToDto()` deliberately never touches `PasswordHash`, which is trivially auditable precisely because the mapping is hand-written.

**Ask:** "We wrote every DTO mapper by hand instead of using AutoMapper. Why, and what does that decision stop from happening by accident?"

**What a strong answer covers:** names the real mechanism (a renamed or added property fails the *build* with manual mapping, but only fails at *runtime*, if ever, with a reflection-based mapper), and can point to `UserMapper` as the concrete stakes — a security-sensitive field staying out of a DTO is enforced by a human having to type the mapping, not by convention. The differentiator: recognizing ADR-002's own admission that at three entities this barely saves code over configuring AutoMapper, and reasoning about where that tradeoff would flip (a growing entity count).

**Follow-up if shallow:** "If this project grew to thirty entities, would you still hand-write every mapper?" (tests whether they can name the actual scale variable ADR-002 itself flags, not just defend the original choice unconditionally.)

## 7. Stale-response guards — pick the right pattern, not the familiar one *(frontend/React, mid-to-senior)*

**Show them:** three different guard shapes in this codebase for the same underlying problem — `ProductList.tsx`'s `requestIdRef` generation counter, `ProductForm.tsx`'s key-based `targetKeyRef`, and `AuthContext.tsx`'s `mountedRef`-only guard (the mentoring note is explicit that the third one still has a real, narrow gap: no ordering guard between the mount-time `/me` check and a mid-flight `login()` call).

**Ask:** "These three components each guard against stale async responses differently. Why aren't they all the same pattern — and which one, if any, is actually incomplete?"

**What a strong answer covers:** recognizes the guard shape should match what can actually race in that component (a list re-fetching vs. a form switching targets vs. an auth check overlapping a login attempt) rather than cargo-culting one pattern everywhere, and can independently spot that `AuthContext`'s `mountedRef`-only guard is the incomplete one — testing whether a candidate reads code for what's *missing*, not just what's there.

**Follow-up if shallow:** "Sketch out, in words, what you'd add to `AuthContext` to close that gap." (tests whether they can actually design the fix — a request-generation counter around the mount-check and the login call — not just spot that something's off.)

## 8. The code review checklist — applied to a real, uncomfortable finding *(any level, process/judgment)*

**Show them:** [the code review checklist](../review/code-review-checklist.md)'s Item 10 — the real SQL Server password and JWT signing key that were committed in plaintext from this repo's very first commit, later rotated and scrubbed from git history via `git-filter-repo`.

**Ask:** "You're reviewing a PR and notice a real credential in a config file. Walk me through what you say in the review comment, and what happens after you approve or block it."

**What a strong answer covers:** doesn't just say "block it" — describes a real remediation sequence in the right order (rotate the credential first, *then* worry about scrubbing it from history), and can explain *why* the order matters: rotating first means the exposed value is already worthless by the time anyone deals with the history problem, so a slow or incomplete history rewrite isn't also a live security exposure. Tests operational judgment under a real, slightly uncomfortable finding, not just pattern-recognition that "secrets shouldn't be committed."

**Follow-up if shallow:** "The credential's already been rotated and the history rewritten. Is this PR done, or is there still something to flag?" (a strong answer notices the *next* PR could reintroduce the same class of mistake, and asks whether anything — a pre-commit hook, a secret scanner — exists to catch it earlier next time; this project's honest answer is no, that gap is still open.)

## Other real material, not used here

Two more checklist items are strong candidates if a loop needs additional rounds: Item 11 (zero controller-level test coverage on `CategoryService`/`ProductsController`'s status-mapping — "every existing test would still pass if either mapping were inverted or dropped") and Item 14 (missing `[ProducesResponseType]` metadata, so the generated OpenAPI spec doesn't match reality). Both are real, current, and well-sourced; they're left out here only because eight questions is the set's own limit, not because they're weaker material.
