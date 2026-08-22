---
title: 'Incident Postmortem: DI Captive-Dependency Failure on GET /api/products'
type: 'chore'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
baseline_commit: '1a4c378416ac6d1b8cf4c22dc23aea542919f755'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md']
---

# Incident Postmortem: DI Captive-Dependency Failure on GET /api/products

## Intent

**Problem:** FR-9 requires a blameless postmortem an EM interviewer can be walked through, but no document exists that turns the Story 1.5 DI captive-dependency reproduction into postmortem form — the raw evidence (ADR-006, the saved log excerpt) exists, but not the incident-response artifact itself.

**Approach:** Write `docs/eng-mgmt/postmortem-di-captive-dependency.md` in standard postmortem shape (Summary/Impact/Detection/Timeline/Root cause/Fix/Follow-up actions), explicit up front that this is a deliberate reproduction narrated as a production incident, not a real outage — reusing the real 48/50-failure evidence and correlation IDs from `story-1-5-di-bug-log-excerpt.md` rather than inventing anything. Reviewed via blind-hunter; 11 of 12 findings patched (an overclaimed blast-radius statement, a missing Detection section, no severity classification, an inaccurate "preserved verbatim" claim, a dropped port-deviation detail, no owner/tracking-link on the open follow-up action, no monitoring/alerting follow-up action, redundant blameless-framing repetition, and a date inconsistency), 1 rejected (author-name formatting — kept consistent with every other Epic 4/5 document's `Prasadmallavalli` byline rather than special-cased here).

## Suggested Review Order

**The framing, since this document's honesty depends on it**

- The opening note states plainly this is a reproduction, not a real outage, and that the Impact section's production framing is a deliberate exercise — added a matching inline reminder in the Timeline so a reader who sees only that section isn't misled.
  [`postmortem-di-captive-dependency.md:5`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L5)
  [`postmortem-di-captive-dependency.md:25`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L25)

**The corrected overclaim**

- Impact originally claimed the endpoint was depended on by "every other page in the app" — the client is actually a single-view SPA with no router; corrected to the accurate claim (the app's one content view) and grounded the severity call in the measured 48/50 failure rate rather than an invented consequence.
  [`postmortem-di-captive-dependency.md:13`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L13)

**Structural gaps the review caught**

- Added a Detection section (honestly noting no monitoring exists to have detected this), a severity classification, and a third follow-up action (no alerting exists) — none were in the first draft.
  [`postmortem-di-captive-dependency.md:19`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L19)
  [`postmortem-di-captive-dependency.md:48`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L48)

**Fidelity to the primary source**

- Fixed an overclaimed "preserved verbatim" (the source log is a partial excerpt, not the complete 48-failure output) and restored a dropped detail (the port-5000-vs-5087 deviation the source log itself flags).
  [`postmortem-di-captive-dependency.md:30`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L30)
  [`postmortem-di-captive-dependency.md:29`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L29)

**The open action item, now trackable**

- Follow-up action 2 (missing DI regression test) gained an owner and a link to its actual `deferred-work.md` entry, rather than citing only the code-review checklist.
  [`postmortem-di-captive-dependency.md:47`](../../docs/eng-mgmt/postmortem-di-captive-dependency.md#L47)
