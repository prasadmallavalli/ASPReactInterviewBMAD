# Architecture Decision Records

Real decisions made while building Epics 1-2 of ASPFullStackBMAD (documented in Story 4.1, 2026-08-20, with ADR-007 added 2026-08-22 per the Epic 2 retrospective). Each record follows Context / Decision / Alternatives / Consequences and traces to a real spec, code review finding, or bug reproduction — see each file for its sources.

Decided during Epics 1-2 (2026-08-18 to 2026-08-19) by Prasadmallavalli (solo project — no separate review board). No Epic 3 (React frontend) decision has its own ADR yet.

To add a new ADR: copy the Context/Decision/Alternatives/Consequences shape from any file here, number it `NNN-slug.md` continuing from the highest existing number, and add a row to the table below.

| ADR | Status | Decision |
| --- | --- | --- |
| [001 — Repository + Unit of Work](001-repository-and-unit-of-work.md) | Accepted | `Application`/`Api` depend only on `ICategoryRepository`/`IProductRepository`/`IUnitOfWork`, never `DbContext` directly. |
| [002 — Manual DTO Mapping](002-manual-dto-mapping.md) | Accepted | Hand-written `ToDto()`/`ToEntity()`/`ApplyTo()` extension methods; no AutoMapper. |
| [003 — httpOnly Cookie Token Storage](003-httponly-cookie-token-storage.md) | Accepted | Login issues the JWT only as an `httpOnly`/`Secure`/`SameSite=Strict` cookie; never in `localStorage` or a response body. |
| [004 — Data Annotations Validation](004-data-annotations-validation.md) | Accepted | Request DTOs validated via Data Annotation attributes + `[ApiController]`'s automatic model-state check; no FluentValidation. |
| [005 — Category Delete: 409, No Cascade](005-category-delete-conflict-no-cascade.md) | Accepted | Deleting a Category with existing Products returns `409 Conflict` via an explicit pre-check; no cascade delete. |
| [006 — Scoped DI Lifetimes](006-scoped-di-lifetimes.md) | Accepted | `DbContext`/repositories/services registered `Scoped`; a captive-dependency bug (Scoped repository misregistered `Singleton`) was deliberately reproduced once, observed, and fixed as the rule's supporting evidence. |
| [007 — CSRF/Anti-Forgery Mechanism](007-csrf-anti-forgery-mechanism.md) | Accepted | Built-in `IAntiforgery`, validated globally on unsafe methods; token issuance lives in `Me()` (not `Login`) so the token is bound to the same identity every later mutation presents. |
