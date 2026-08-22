# Design Doc: Scaling the Product List (Pagination + Indexing)

Status: Proposed (not implemented) · Date: 2026-08-20 · Author: Prasadmallavalli

## Problem

`GET /api/products` returns every row in the `Products` table, unordered, in one response:

```csharp
// ProductRepository.cs
public async Task<IEnumerable<Product>> GetAllAsync(CancellationToken cancellationToken = default)
{
    return await _context.Products.AsNoTracking().ToListAsync(cancellationToken);
}
```

`ProductService.GetAllAsync` and `ProductsController.GetAll` pass this straight through with no `Skip`/`Take`, no `OrderBy`, and no query parameters. The React client (`ProductList.tsx`) fetches once on mount and renders every row into a single `<table>`. This already appears twice in [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) (Story 1.3, Story 3.2) as a known, accepted-for-now gap. This doc is the ADR-style follow-through: pick a real design for when it stops being fine, not just note that it's a gap.

## Where this actually breaks

At the row counts this project runs at today (a handful of demo products), none of this matters — the table scan is sub-millisecond and the payload is a few KB. Three things degrade independently as the table grows, and they degrade at different thresholds:

- **Network payload.** Each `ProductDto` is small (~100-150 bytes serialized), but at 10,000 rows that's 1-1.5MB on every list load, un-cached, on every mount (`ProductList` has no client-side cache — Story 3.1's `apiFetch` has no caching layer). This is the first thing a real user would notice, well before the database struggles.
- **Query cost.** `SELECT * FROM Products` with no `WHERE`/`ORDER BY` is a full clustered-index scan (`PK_Products` on `Id`, the only clustered index). SQL Server handles this fine into the tens of thousands of rows; it becomes the dominant cost only well past where the payload size has already made the feature unusable.
- **Client render cost.** React re-rendering an unkeyed-by-virtualization `<table>` with thousands of `<tr>`s is the one that degrades first on low-end devices — well before either server-side cost — since nothing here does list virtualization.

Payload size is the binding constraint, not query performance — which shapes the design below: the fix has to cap what crosses the wire, not just make the database query faster.

## Options considered

**A. Offset pagination** (`?skip=40&take=20`, translated to EF Core `.Skip().Take()`).

The obvious first reach, and it's what most tutorials show. Rejected as the primary mechanism because two of its costs are real at this project's shape specifically: (1) `OFFSET` still requires SQL Server to walk and discard every skipped row under the covers — cheap at 20 vs 40, meaningfully non-free once catalogs reach page 500+; (2) pages drift under concurrent writes — if a product is deleted while a user is on page 3, every subsequent page shifts by one, silently duplicating or skipping a row. For a single-writer local demo this drift is nearly unobservable, but it's the kind of bug that only shows up in production under real concurrent traffic, which is exactly the scenario a scaling doc should design for rather than dismiss.

**B. Keyset (cursor) pagination** (`?after={lastId}&limit=20`, translated to `WHERE Id > @lastId ORDER BY Id`).

Chosen. `Id` is an indexed, monotonically increasing integer primary key, so `WHERE Id > @lastId` is an index seek (not a scan) regardless of how deep the pagination goes — page 500 costs the same as page 1. It's also stable under concurrent writes: a delete elsewhere in the table doesn't shift anyone else's cursor, because the cursor is a value, not a row count. The real cost, paid honestly: no "jump to page 47" — keyset pagination only supports next/previous, not arbitrary page numbers, because there's no cheap way to know what the 940th row is without walking there. That's an acceptable product tradeoff for a catalog browsed sequentially, and a real one if this ever needed a page-number UI.

**C. Do nothing, add response compression / a CDN cache in front of it instead.**

Considered as a cheaper lever. Rejected as the *primary* fix because it doesn't address the actual failure mode — an unbounded list still means an unbounded (if compressed) payload, and this catalog's data changes via user mutations (Stories 3.3-3.5), so a cache needs invalidation logic anyway. Worth doing *in addition to* pagination once real traffic exists, not instead of it — noted under Out of Scope.

## Chosen design

**API contract change** (would require its own spec if implemented — this doc is the design, not the build):

```
GET /api/products?after={id}&limit={n}&categoryId={optional}
→ { "items": ProductDto[], "nextCursor": number | null }
```

- `after` omitted or absent = first page. `limit` defaults to 20, validated by a bound `[Range(1, 100)]` query DTO (below) rather than an unchecked raw parameter — an unclamped `limit` would let a client request the whole table in one call and defeat the point of pagination entirely.
- `nextCursor` is the last item's `Id`, or `null` when the page returned fewer than `limit` rows (end of the list) — the client never has to guess.
- `categoryId` is included now, not bolted on later, because it changes the index shape needed (below) — designing the cursor contract without it would mean a breaking change the first time category filtering is added.
- This changes `GET /api/products`'s response shape from a bare `ProductDto[]` to an envelope object — a breaking change for any consumer of the current contract. `ProductList.tsx` is the only consumer today, so this doc treats it as an in-place breaking change to the existing route rather than standing up a versioned/parallel endpoint; that call would need revisiting if a second consumer (e.g. a future admin tool) ever existed.

**Layers that change.** `IProductRepository` (`Domain/Interfaces`) has no method shaped like this today — it would need a new `GetPageAsync` member, per AD-2's own rule ([ADR-001](../adr/001-repository-and-unit-of-work.md)) that Application/Api code against the interface, never `DbContext` directly. `IProductService`/`ProductService.GetAllAsync` and `ProductsController.GetAll` both need matching changes, plus a new `PagedResultDto<ProductDto>` (or similar) to carry `items`/`nextCursor` across the API boundary per AD-9's manual-mapping convention ([ADR-002](../adr/002-manual-dto-mapping.md)). The snippet below is the repository layer only — the other three layers are real, non-optional parts of this change, not shown here for brevity.

```csharp
// Bound query DTO, not raw [FromQuery] scalars — [FromQuery] parameters
// don't get [ApiController]'s automatic Data Annotation validation (AD-8)
// the way a request body DTO does; binding to a class restores it.
public class ProductPageQuery
{
    public int? After { get; set; }

    [Range(1, 100)]
    public int Limit { get; set; } = 20;

    public int? CategoryId { get; set; }
}

public async Task<IEnumerable<Product>> GetPageAsync(
    int? afterId, int limit, int? categoryId, CancellationToken ct = default)
{
    var query = _context.Products.AsNoTracking();
    if (categoryId is not null) query = query.Where(p => p.CategoryId == categoryId);
    if (afterId is not null) query = query.Where(p => p.Id > afterId);
    return await query.OrderBy(p => p.Id).Take(limit).ToListAsync(ct);
}
```

**Index change — filtered case only.** The unfiltered keyset query (`WHERE Id > @lastId ORDER BY Id`) is already served perfectly by the existing clustered index on the PK (`PK_Products`, confirmed in the `InitialCreate` migration) — no new index is needed for that path. The gap is the *filtered* query, `WHERE CategoryId = @c AND Id > @lastId ORDER BY Id`: today's only secondary index, the auto-generated `IX_Products_CategoryId`, is single-column, so SQL Server would still need to sort after filtering. A composite index closes that gap:

```csharp
modelBuilder.Entity<Product>()
    .HasIndex(p => new { p.CategoryId, p.Id });
```

This serves the filtered-and-paginated query (seek on `CategoryId`, already ordered by `Id` within each category) and can supersede `IX_Products_CategoryId` outright, since any query the old single-column index served, this one also serves. The honest cost: every `Product` insert/update/delete now maintains one more index, and — for a catalog that's already grown past the point this doc is worried about — building it is itself a locking/duration concern on a live table, not a free schema tweak. For a catalog with far more reads than writes (browsing vs. the occasional Create/Edit/Delete from Stories 3.3-3.5), the ongoing write cost is a good trade; the one-time migration cost at high row counts is a real operational step this doc flags but doesn't design (online index build strategy, maintenance window, etc.).

## Consequences

- `ProductList.tsx` changes from "fetch once, render all" to a paged/infinite-scroll model — its current `requestIdRef` stale-response-guard pattern (Story 3.2) still applies per-page-fetch, but the component gains real state it doesn't have today: current cursor, accumulated items, "has more" flag. This is a bigger frontend change than the backend side. It also changes what "refresh" means: `handleDelete`'s current success path calls the same single-shot `fetchProducts()` used on mount — under paging that has to either reset to page 1 and re-walk, or splice the deleted row out of accumulated state directly; not designed here, but a real decision the implementation would face immediately.
- Sorting by anything other than `Id` (e.g. by `Name`, a natural ask) needs a composite cursor (`(Name, Id)`, `Id` as tie-breaker for duplicate names) and a matching composite index — not designed here, since no story has asked for it yet; flagged so a future "sort the product list" story doesn't have to rediscover this constraint from scratch.
- No total row count ships in this contract. `SELECT COUNT(*)` at scale is its own cost (a second scan, or an approximate-count strategy), and "page 3 of 47" isn't answerable from a cursor alone. If a future requirement needs a total, it's a deliberately separate, slower endpoint — not free from this design.
- This is a bigger scope than the story that shipped `ProductList` (Story 3.2) approved — implementing it for real means renegotiating that spec's frozen I/O matrix, not a drop-in patch.
- `CategoryRepository.GetAllAsync` has the identical unbounded, unordered shape — `ProductRepository.cs`'s own header comment notes it "mirrors `CategoryRepository`" — so this is framed as a Products-only fix but the same design would apply to `/api/categories` (and likely a future `Users` listing) once any of them grow. Not designed here; flagged so it isn't rediscovered as a surprise.
- No accessible way to announce paging state exists yet. `ProductList.tsx` already uses `role="status"` for loading and `role="alert"` for errors (Story 3.2) — a "load more"/end-of-list transition under this design needs the same deliberate treatment, not a silent DOM change.
- New test surface: empty-first-page, last-page (`nextCursor: null`), and category-filtered-cursor combinations all need coverage matching this project's existing service-layer-unit-test-plus-controller-I/O-matrix pattern (Story 1.6's precedent) — not written here, but a real addition to whatever story implements this.
- The changed query-parameter set and response envelope need `[ProducesResponseType]`/OpenAPI updates to stay accurate — the same already-deferred gap logged against `CategoriesController`/`ProductsController` in [`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md) would otherwise grow to cover a shape that no longer matches reality.

## Out of scope (noted, not designed)

- **Response caching** (HTTP caching headers, or an in-memory/Redis cache in front of `GetPageAsync`) — a real complementary lever once traffic (not just row count) is the bottleneck; needs invalidation logic tied to Create/Update/Delete, which is its own design.
- **Full-text search** — filtering by `categoryId` is a simple equality index; a `Name` search is a different problem (LIKE '%...%' doesn't use a B-tree index at all) and would need its own doc if ever prioritized.
- **List virtualization on the client** — helps the render-cost dimension independently of pagination; worth doing together but is a separate, smaller decision (e.g. adopting a virtualization library) not covered here.
- **Rate limiting / abuse throttling** — even with `limit` clamped to 100, a client can still walk the entire catalog by repeating cursor requests; this doc caps the cost of any *single* request, not the cost of a client making many of them. Same already-deferred gap as the auth endpoints' missing rate limiting ([`deferred-work.md`](../../_bmad-output/implementation-artifacts/deferred-work.md), Stories 2.1/2.2) — a project-wide decision, not specific to this endpoint.
