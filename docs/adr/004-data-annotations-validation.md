# ADR-004: Data Annotations + `[ApiController]` for Validation, No FluentValidation

Status: Accepted
Date: 2026-08-18 to 2026-08-19 (Stories 1.2/1.3/2.1/2.2) · Deciders: Prasadmallavalli

## Context

Every request DTO in the project (`CategoryRequestDto`, `ProductRequestDto`, `UserRegistrationRequestDto`, `UserLoginRequestDto`) needs input validation before it reaches a service. Stories 1.2/1.3/2.1/2.2 used Data Annotation attributes directly on the DTOs — `[Required]`, `[StringLength(200)]`, `[Range(0.01, 1000000)]`, `[EmailAddress]` — relying on `[ApiController]`'s automatic model-state check to short-circuit into a `400 ValidationProblemDetails` response with no controller code written for it. This is the `[ASSUMPTION]`-tagged AD-8 in [`ARCHITECTURE-SPINE.md`](../../_bmad-output/planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md).

## Decision

Validation is expressed as Data Annotation attributes on request DTOs, enforced automatically by `[ApiController]`'s model-state pipeline. No FluentValidation (or other validator-library) dependency for this project's scope.

## Alternatives

- **FluentValidation.** Rejected as an added dependency and a separate validator-class-per-DTO pattern, for a validation surface that — at the time the decision was made — was simple field-level presence/length/range checks with no cross-field or conditional rules.

## Consequences

- Zero extra dependency, minimal ceremony, and validation "just happens" via the framework pipeline for the common presence/length/range cases — which covers most of this project's actual DTOs.
- **That assumption didn't fully hold up under review.** [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) logs two real, still-open validation gaps that Data Annotations can't express cleanly, with no tracked ticket beyond that log entry: `CategoryRequestDto.Name`/`ProductRequestDto.Name` accept whitespace-only strings because `[Required]` only checks for null/empty, not "trimmed and non-blank"; and `[Range(0.01, 1000000)]` on `Price` bounds the value but not its decimal scale, so a client can send `12.3456789` and risk silent truncation against the `decimal(18,2)` column. Both were flagged in review and explicitly deferred rather than fixed, because closing them with Data Annotations means writing a custom `ValidationAttribute` per case — exactly the kind of composable, testable-in-isolation rule FluentValidation is built for. Both gaps exist today specifically because Data Annotations don't compose well past simple per-property checks, and both remain open rather than fixed, because fixing them properly means introducing custom attributes one at a time rather than a single reusable validation approach.
- If the DTO surface grows more conditional or cross-field rules (e.g. "reject if X unless Y"), this decision will need revisiting — Data Annotations were the right choice for the validation this project actually has, not necessarily for validation in general.
