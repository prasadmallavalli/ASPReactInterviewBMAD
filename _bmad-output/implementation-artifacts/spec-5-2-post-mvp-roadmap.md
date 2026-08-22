---
title: 'Post-MVP Roadmap: ASPFullStackBMAD Product Catalog'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: 'b9e09d2661c280c58551b17da4a3a54f24ac4ee3'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
---

# Post-MVP Roadmap: ASPFullStackBMAD Product Catalog

## Intent

**Problem:** FR-10 requires a post-MVP roadmap that speaks to real product direction, not a generic feature wishlist — but no document ties this project's many already-logged, real gaps into a coherent 2-3 horizon story an EM interviewer could evaluate.

**Approach:** Write `docs/eng-mgmt/post-mvp-roadmap.md` with 3 horizons (catalog scale, account security, production operability), each opening with a user- or business-facing "Why" before any technical task list, grounded in real citations to `deferred-work.md`, the scaling design doc, and Story 5.1's postmortem. Reviewed via blind-hunter; all 13 findings patched (0 deferred, 0 rejected) — mostly gaps where the roadmap undercited real, already-logged problems it was directly adjacent to (categories' twin pagination gap, several more auth gaps, a dependency-hygiene advisory, accessibility as a cross-cutting concern, missing owners/definitions-of-done, and an unacknowledged prioritization tension in the sequencing note).

## Suggested Review Order

**The corrected overclaim**

- Horizon 1 originally called the pagination work "ready to implement, not a fresh investigation" — the design doc's own Consequences section says the opposite (frozen-spec renegotiation, bigger frontend scope than backend). Corrected to state the design is done, not the implementation size.
  [`post-mvp-roadmap.md:13`](../../docs/eng-mgmt/post-mvp-roadmap.md#L13)

**Gaps the review found adjacent to each horizon's own citations**

- Horizon 1 gained the `CategoryRepository` twin-gap and the rate-limiting cross-reference back from the design doc's own "Out of scope" section.
  [`post-mvp-roadmap.md:11`](../../docs/eng-mgmt/post-mvp-roadmap.md#L11)
- Horizon 2 gained four more already-logged auth gaps (password policy, timing side-channel, JWT `jti`/revocation, cookie-lifetime mismatch) and the plaintext-signing-key gap that directly contradicted its own "real product" framing — plus an explicit acknowledgment that accessibility (the most-repeated gap category in `deferred-work.md`) is real but deliberately not its own horizon.
  [`post-mvp-roadmap.md:19`](../../docs/eng-mgmt/post-mvp-roadmap.md#L19)
  [`post-mvp-roadmap.md:23`](../../docs/eng-mgmt/post-mvp-roadmap.md#L23)
- Horizon 3 gained the `Microsoft.OpenApi` dependency advisory, the check-then-act races (checklist Item 5), and the missing controller-level test coverage (checklist Item 11) — all already logged, all fitting "operate as a production service" exactly, none named in the first draft. Also fixed an undercounted citation ("already-twice-flagged" → the gap is actually independently logged in three places before the postmortem's own mention).
  [`post-mvp-roadmap.md:29`](../../docs/eng-mgmt/post-mvp-roadmap.md#L29)
  [`post-mvp-roadmap.md:31`](../../docs/eng-mgmt/post-mvp-roadmap.md#L31)

**Process additions matching this project's own convention**

- Every horizon gained an explicit Owner and Definition of done, matching `deferred-work.md`'s and the Story 5.1 postmortem's own per-item-owner convention — absent from the first draft.
  [`post-mvp-roadmap.md:15`](../../docs/eng-mgmt/post-mvp-roadmap.md#L15)
  [`post-mvp-roadmap.md:25`](../../docs/eng-mgmt/post-mvp-roadmap.md#L25)
  [`post-mvp-roadmap.md:33`](../../docs/eng-mgmt/post-mvp-roadmap.md#L33)

**Honest tension, not smoothed over**

- The Sequencing note now names the tension it originally hid: ranking Horizon 3 last by user-visibility isn't the same as saying it should be built last, since CI/regression-test investment reduces delivery risk for Horizons 1 and 2.
  [`post-mvp-roadmap.md:39`](../../docs/eng-mgmt/post-mvp-roadmap.md#L39)
