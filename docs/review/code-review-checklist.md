# Code Review Checklist

Status: Active · Date: 2026-08-20 · Author: Prasadmallavalli

Fifteen items, each derived from a real decision, pattern, or bug in this codebase — not generic "write good code" advice. 11 of the 15 are demonstrated below with an example review comment as if left on that finding's commit; one of those 11 (Item 3) predates this repo's git history and is grounded in a saved log instead of a live diff — flagged explicitly where it appears, not glossed over. Items 1, 2, 4, and 8 have no real violation on record in this codebase to point at and are left as-is rather than forcing an example.

**A note on commit granularity:** this repo was `git init`'d partway through the build (see `git log` — `f1bc57f` is a single "Initial commit" bundling everything through Story 2.2's code). Findings attributed to Epic 1 and most of Epic 2 point at that one commit, not a per-story commit, because no finer-grained history exists to point at. Story 2.3 is the actual granularity boundary — it's the first story with its own dedicated commit (`32cfbec`), not Epic 3.

**A note on AD-# vs ADR-###:** items below cite two different, overlapping artifacts. `AD-#` (e.g. AD-2, AD-4, AD-8) refers to the numbered architectural decisions in [`ARCHITECTURE-SPINE.md`](../../_bmad-output/planning-artifacts/architecture/architecture-ASPFullStackBMAD-2026-08-18/ARCHITECTURE-SPINE.md) — the original, terse decision log. `ADR-###` (e.g. ADR-006) refers to the fuller Context/Decision/Alternatives/Consequences writeups under `docs/adr/`, added later in Story 4.1 for a subset of those same decisions. Where both exist for a decision, the `ADR-###` doc is the more complete source.

**How to use this checklist:** run it manually against a story's diff during its code-review step (already this project's practice — see the `bmad-build` skill's review layers). Items 1-10 (architecture, data integrity, security) are correctness concerns and should block a merge if newly violated by the diff under review. Items 11-14 (testing, frontend resilience, documentation accuracy) are strong-should, not hard blockers — flag them, but use judgment about whether they're worth delaying the merge. Item 15 governs what happens to anything this checklist finds that isn't fixed inline: it goes to `deferred-work.md` with a `source_spec` and `evidence`, not into a conversation that evaporates. No CI enforcement exists for any of this — it's a human-run checklist, not an automated gate.

## The Checklist

**Architecture & Layering**

1. **Layering (AD-2).** Does any new `Application`/`Api` code reference `DbContext`, `DbSet<T>`, or any `Microsoft.EntityFrameworkCore` type directly, instead of going through `IUnitOfWork`/a repository interface?
2. **DTO boundary (AD-3/AD-9).** Does every new controller action accept/return a DTO, never a Domain entity — and does every new field on a Domain entity get an explicit mapper decision (included or deliberately excluded), rather than silently crossing the boundary?
3. **DI lifetime (AD-4).** Does any new `AddScoped`/`AddSingleton`/`AddTransient` registration mismatch what it captures — specifically, is anything that holds or transitively depends on a Scoped `DbContext` registered `Singleton`?
4. **Frozen-spec boundary.** Does the diff match what the approved spec's `<frozen-after-approval>` Intent/Boundaries actually authorized, with a Spec Change Log entry for anything that had to change from the original plan?

**Data Integrity & Concurrency**

5. **Check-then-act races.** Does a new "existence check, then act" sequence (an existence check followed by an insert/delete) rely on a check that can go stale before the write commits, with no transaction or exception-translation fallback backing up the response shape it promises?
6. **List query determinism.** Does a new list-returning query lack an explicit `OrderBy`, leaving row order unspecified across calls?
7. **Validation composability (AD-8).** For a new Data-Annotation-validated field, does `[Required]` alone actually enforce the intended rule — or does it only check null/empty while the real intent needs a trim/normalize step or a scale/precision bound `[Range]` doesn't cover?

**Security & Validation**

8. **CSRF/auth exemptions, reasoned not copied.** Is every state-changing endpoint (`POST`/`PUT`/`DELETE`) carrying `[Authorize]`, and if one is deliberately exempt (`[IgnoreAntiforgeryToken]`), is the exemption justified in a comment rather than silently copy-pasted onto the next endpoint?
9. **Timing side channels on auth paths.** Does a new branch in a registration/login flow do meaningfully different work (e.g. skip password hashing, skip a lookup) depending on whether a resource exists, in a way an attacker could use to distinguish the two outcomes by response time?
10. **Secrets in tracked files.** Does the commit introduce a real credential or signing-key value into a git-tracked file, rather than reading it from an untracked/environment-scoped config?

**Testing & Frontend Resilience**

11. **Controller-level status-mapping tests.** For a multi-branch service result mapped to different HTTP statuses in the controller, is there a test exercising the controller's mapping itself — not only what the service method returns in isolation?
12. **Stale-response guards in async UI.** Does a new `fetch`-in-`useEffect` guard against unmount/superseded-request races (the `requestIdRef`/`mountedRef` pattern already established in this codebase), or can a slow, superseded response overwrite fresher state?
13. **Cross-flag state interaction.** When new component state (a loading/error/editing flag) is added to a component that already owns several independent flags, is the new flag's interaction with the existing ones actually exercised by a test — not just assumed independent?
14. **OpenAPI/`[ProducesResponseType]` accuracy.** Does a controller action's actual status-code branches match what's declared (or left undeclared) in its OpenAPI metadata?
15. **Deferred-work hygiene.** When review finds a real, unfixed gap, is it logged to `deferred-work.md` with a `source_spec` and `evidence` — not just mentioned in conversation and dropped?

## Applied Retroactively

**Item 3 (DI lifetime) — the canonical example, Story 1.5.**

Story 1.5 deliberately registered `IProductRepository` as `AddSingleton` instead of `AddScoped`, then observed 48 of 50 concurrent requests fail with `System.InvalidOperationException` (full trace in `story-1-5-di-bug-log-excerpt.md`; see [ADR-006](../adr/006-scoped-di-lifetimes.md) for the full account). The bug and its fix both predate `git init`, so there's no before/after commit pair to link the way Item 12 below has — the finding is grounded in the saved reproduction log, not a live diff. `f1bc57f` is where the *already-reverted-to-`AddScoped`* registration lives in this repo's history, not the buggy state itself.

> Item 3: `IProductRepository` is `AddSingleton` here, but it (and everything downstream of it) holds a Scoped `AppDbContext`. Under concurrent requests this captive-dependency pattern will throw `InvalidOperationException` from EF Core's `ConcurrencyDetector` — see AD-4. Should be `AddScoped`.

Post-review, `ValidateScopes`/`ValidateOnBuild` were enabled outside Development too (`Program.cs:25-26`), so this class of misregistration now fails fast at startup in any environment — a reader relying on this checklist item alone should know that startup guardrail, not just code-review vigilance, is now a second line of defense.

*Proposed, not yet built: this finding would be a strong basis for a future Epic 5 SBI feedback-framework example — a concrete situation (Story 1.5's load test), a specific behavior (the exact misregistration line), and a measured impact (48/50 requests failing, full stack traces). Flagging the fit now, since Epic 5 doesn't exist yet as of this writing.*

**Item 5 (check-then-act race) — `f1bc57f`, `CategoryService.DeleteAsync` (still present today).**

```csharp
// src/Application/Services/CategoryService.cs:68-74
if (await _unitOfWork.Categories.HasProductsAsync(id, cancellationToken))
{
    return CategoryDeleteResult.HasProducts;
}

_unitOfWork.Categories.Remove(category);
await _unitOfWork.SaveChangesAsync(cancellationToken);
```

> Item 5: `HasProductsAsync` can pass, then a `Product` insert lands before `SaveChangesAsync` commits the delete. The DB's `Restrict` FK still blocks the actual delete, but the caller gets an unhandled 500 (shaped as ProblemDetails, since `UseExceptionHandler()` was added during review — not a raw crash) instead of a clean 409 in that window. Worth a Domain-level exception type Infrastructure can translate — see AD-2's constraint on why `CategoryService` can't just catch `DbUpdateException` directly, and [ADR-005](../adr/005-category-delete-conflict-no-cascade.md) for the full reasoning behind this endpoint's 409-vs-cascade design.

Already logged: `deferred-work.md` (Story 1.2 section). Re-verified present in the current tree while writing this checklist — still open, not a stale claim.

**Item 6 (list query determinism) — `f1bc57f`, `CategoryService`/`ProductService.GetAllAsync`.**

```csharp
// src/Infrastructure/Repositories/ProductRepository.cs
public async Task<IEnumerable<Product>> GetAllAsync(CancellationToken cancellationToken = default)
{
    return await _context.Products.AsNoTracking().ToListAsync(cancellationToken);
}
```

> Item 6: no `OrderBy` here — row order isn't guaranteed stable across calls. If the UI (or a future paginated endpoint) depends on a consistent order, add `.OrderBy(p => p.Id)` explicitly rather than relying on incidental physical storage order.

Already logged: `deferred-work.md` (Story 1.2 and 1.3 sections — the Category and Product twins of the same gap).

**Item 7 (validation composability) — `f1bc57f`, `CategoryRequestDto`/`ProductRequestDto.Name`.**

```csharp
// src/Application/DTOs/CategoryRequestDto.cs:13-15
[Required]
[StringLength(200)]
public required string Name { get; set; }
```

> Item 7: `[Required]` rejects null/empty but not `"   "` — a whitespace-only name passes validation and persists as-is. If the intent is "a real name," this needs a custom `ValidationAttribute` or a trim-and-recheck step; `[Required]` alone doesn't express it.

Already logged: `deferred-work.md` (Story 1.2 and 1.3 sections, Category and Product respectively). Re-verified present in the current tree.

**Item 9 (timing side channel) — `f1bc57f`, `UserService.LoginAsync`.**

```csharp
// src/Application/Services/UserService.cs:78-84
var user = await _unitOfWork.Users.GetByEmailAsync(normalizedEmail, cancellationToken);
if (user is null)
{
    return (UserLoginResult.InvalidCredentials, null, null);
}

var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
```

> Item 9: the unknown-email branch returns immediately; the wrong-password branch first runs `VerifyHashedPassword` (deliberately slow, by design of the hasher). Both return the same 401, but the extra work on one path is a measurable timing difference — a real, if narrow, email-enumeration side channel.

Already logged: `deferred-work.md` (Story 2.2 section, flagged independently by two review lenses).

**Item 10 (secrets in tracked files) — `f1bc57f` (introduced), `0242d85`/`48c9b34`/`488bb4c` (remediated).**

`docker-compose.yml` and `appsettings.Development.json` both committed the real SQL Server `sa` password and the JWT signing key in plaintext, starting from the initial commit.

> Item 10: this is a real credential, not a placeholder — it shouldn't be in a tracked file at all, even for local dev. At minimum, rotate it before this merges; better, move it to `dotnet user-secrets` or an untracked `.env` and never let a real value land in git history.

This is the one item in this checklist with a full before/after remediation trail: `0242d85` rotated both values, `48c9b34` stopped tracking `appsettings.Development.json` going forward, and `488bb4c` records that git history itself was rewritten (`git-filter-repo`) to scrub the original pre-rotation values from every commit and blob, then force-pushed. Already logged: `deferred-work.md` (Story 1.5 section, and the post-implementation-ops entries under Story 2.3).

**Item 11 (controller-level status-mapping tests) — `f1bc57f`, `CategoriesController.Delete` / `ProductsController`.**

`CategoryService.DeleteAsync`'s `HasProducts` → 409 branch and `ProductsController`'s `ProductWriteResult` → HTTP-status mapping (`CategoryNotFound` → 400, `NotFound` → 404) both have zero controller-level test coverage — confirmed by a repo-wide grep finding no test references either switch. Every existing test would still pass if either mapping were inverted or dropped.

> Item 11: `ProductServiceTests.cs` asserts what the service returns, but nothing asserts what the controller does with that result. Add a test that hits the controller (or an integration test through `/api/products`) with an invalid category id and asserts the actual HTTP status, not just the service-level enum.

Already logged: `deferred-work.md` (Story 2.3 section, flagged by verification-gap with the repo-wide-grep evidence cited above).

**Item 12 (stale-response guard) — `0492444`, Story 3.2, `ProductList.tsx` — checklist working as intended.**

Unlike the three findings above (still open), this one shows the checklist catching an issue *during* review, before commit — the `requestIdRef` generation-counter guard in `ProductList.tsx` was a review patch applied to Story 3.2's implementation, not a gap that shipped. The commit above is the post-review state.

> Item 12: the mount-time fetch has no guard against a slow, superseded response landing after a newer one — add a request-generation counter and drop any response whose id doesn't match the latest.

This pattern was then reused as the established convention for every subsequent async fetch in the codebase (Stories 3.3-3.5), which is the intended effect of a checklist item: not just catching one bug, but setting a pattern the team repeats.

**Item 13 (cross-flag state interaction) — `ffa822e`, Story 3.5, `ProductList.tsx` — a live, currently-open gap.**

`ProductList.tsx` owns four state pieces that can interact: the mount-time `state` (loading/error/success), `isFetching`, `deletingIds`, and `deleteError`. Grepping `ProductList.test.tsx` (15 `it(...)` cases as of this writing) turns up no test for what happens when a DELETE succeeds but the follow-up `fetchProducts()` refresh itself then fails — every existing delete test assumes the refresh succeeds.

> Item 13: this test suite covers delete-success and delete-failure separately, but not the case where delete succeeds and the *refresh* afterward fails. Right now that flips the whole view to the generic fetch-error screen with no indication the delete actually worked — is that the intended behavior, or does the user need to be told the delete succeeded before this error state took over?

Already logged: `deferred-work.md` (Story 3.5 section) — found during that story's own review but left open as a real edge case needing a three-way state model, not a same-file patch. Re-verified: still no such test exists in the current suite.

**Item 14 (OpenAPI accuracy) — `f1bc57f`, `CategoriesController`/`AuthController`.**

Neither `CategoriesController`'s actions nor `AuthController.Login`/`Me` declare `[ProducesResponseType]` attributes, so the OpenAPI document `AddOpenApi()` generates only documents each action's default success response — not the 404/409/400/401 outcomes these endpoints actually produce.

> Item 14: this endpoint returns 404/409 on real, expected paths, but the generated OpenAPI spec won't show that without `[ProducesResponseType]` attributes. Cheap to add now; expensive to reconstruct later once a consumer starts relying on the (inaccurate) generated spec.

Already logged: `deferred-work.md` (Story 1.2 section for `CategoriesController`, Story 2.2 section for `AuthController`).

**Item 15 (deferred-work hygiene) — process-level, positive example, not a gap.**

Every story's review in this project appended real findings to `deferred-work.md` with `source_spec` and `evidence` (see the file's `2026-08-18` through `2026-08-20` sections) rather than letting them evaporate once the conversation moved on. Included here as a working example of the item, not a finding against this codebase — a checklist should surface what's already going right, not only what's broken.

## Summary

| Item | Commit | Outcome |
|---|---|---|
| 3 — DI lifetime | pre-git-init (Story 1.5); registration lives in `f1bc57f` | Found, fixed same story; canonical SBI candidate |
| 5 — check-then-act race | `f1bc57f` (Story 1.2) | Found, still open (`deferred-work.md`) |
| 6 — list query determinism | `f1bc57f` (Stories 1.2/1.3) | Found, still open (`deferred-work.md`) |
| 7 — validation composability | `f1bc57f` (Stories 1.2/1.3) | Found, still open (`deferred-work.md`) |
| 9 — timing side channel | `f1bc57f` (Story 2.2) | Found, still open (`deferred-work.md`) |
| 10 — secrets in tracked files | `f1bc57f`; remediated `0242d85`/`48c9b34`/`488bb4c` | Found and fully remediated |
| 11 — controller-level status-mapping tests | `f1bc57f` (Stories 1.2/1.3, surfaced in 2.3's review) | Found, still open (`deferred-work.md`) |
| 12 — stale-response guard | `0492444` (Story 3.2) | Found and fixed pre-commit; became the standing pattern |
| 13 — cross-flag state interaction | `ffa822e` (Story 3.5) | Found, still open (`deferred-work.md`) |
| 14 — OpenAPI accuracy | `f1bc57f` (Stories 1.2/2.2) | Found, still open (`deferred-work.md`) |
| 15 — deferred-work hygiene | project-wide | Passing example, not a gap |

Items 1, 2, 4, and 8 have no worked example — no violation of them exists on record in this codebase to point at honestly. They're actionable and stay in the checklist for the next diff that tests them.
