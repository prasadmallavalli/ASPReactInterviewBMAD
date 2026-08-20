# ADR-002: Manual DTO Mapping (`ToDto()`/`ToEntity()`), No AutoMapper

Status: Accepted
Date: 2026-08-18 (Story 1.2-1.3) · Deciders: Prasadmallavalli

## Context

AD-3 requires that Domain entities never cross the API boundary — controllers accept and return DTOs only. Story 1.2 introduced `CategoryMapper` with `ToDto()`/`ToEntity()`/`ApplyTo()` extension methods; Story 1.3 mirrored it in `ProductMapper`, with `ToEntity()` taking an already-loaded `Category` rather than re-querying, and `ApplyTo()` touching only the `CategoryId` scalar so EF Core's change tracking picks up the FK change. This is the decision the architecture spine already earmarks as `ADR-002` ([`ARCHITECTURE-SPINE.md`](../../_bmad-output/planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md), AD-9).

## Decision

Mapping between entities and DTOs is hand-written via extension methods in `Application` (`ToDto()`, `ToEntity()`, `ApplyTo()`). No AutoMapper (or similar reflection-based mapper) dependency.

## Alternatives

- **AutoMapper.** Rejected. AutoMapper hides mapping behavior in reflection-based profile configuration — a renamed or added property fails silently at runtime instead of failing the build, and profiles have to be tested to catch what the C# compiler would catch for free with explicit methods. It's also one more dependency and one more thing a reader unfamiliar with the codebase has to learn, for a mapping surface (`Category`, `Product`, `User` — three entities, a handful of fields each) that is genuinely small.

## Consequences

- The compiler catches a renamed or removed property immediately; there is no reflection-based mapping bug that only shows up at runtime.
- The DTO boundary is trivially auditable — anyone can open `CategoryMapper.cs`/`ProductMapper.cs`/`UserMapper.cs` and see exactly which fields cross the boundary (e.g. `UserMapper.ToDto()` deliberately never touches `PasswordHash`).
- Every new entity requires a new hand-written mapper file, and `ApplyTo()`-style partial-update methods carry a maintenance risk: if a property is added to an entity/DTO, nothing forces the corresponding mapper to be updated, unlike a convention-based mapper that would pick it up automatically (for better or worse).
- **Known limitation, not a free lunch:** at three entities, hand-writing four mapping methods is barely less code than configuring AutoMapper profiles would be — this decision doesn't scale gracefully. If this project grew to dozens of entities, the boilerplate would become real toil and AutoMapper's convention-based approach would start paying for itself. Part of the reason manual mapping was chosen here is its teaching/portfolio value — explicit code is easier to walk an interviewer through — which is a legitimate but non-technical reason weighed alongside the compiler-safety argument.
