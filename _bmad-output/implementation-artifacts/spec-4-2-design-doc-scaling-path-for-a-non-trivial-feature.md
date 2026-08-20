---
title: 'Design Doc: Scaling the Product List (Pagination + Indexing)'
type: 'chore'
created: '2026-08-20'
status: 'done'
route: 'one-shot'
baseline_commit: 'bed397f28122419fb1a633af2ed2c04b747c739b'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-4-context.md']
---

# Design Doc: Scaling the Product List (Pagination + Indexing)

## Intent

**Problem:** `GET /api/products` returns every row unordered in one response with no pagination, and this gap has already been logged twice in `deferred-work.md` (Stories 1.3, 3.2) with no real design behind the "will need addressing later" note.

**Approach:** Write a design doc covering the product list's real scaling path — offset vs. keyset pagination, the index change keyset needs, the API contract change, and the honest consequences (frontend rework, breaking change to the current route, test/a11y/index-migration costs) — grounded in this codebase's actual `ProductRepository`/`ProductsController`/`ProductList.tsx`, not generic pagination advice. Reviewed via blind-hunter; all 12 findings patched in place (0 deferred, 0 rejected).

## Suggested Review Order

**The design's core claim and its correction**

- Keyset pagination chosen over offset pagination for O(1)-depth index seeks and stability under concurrent writes; the index-change rationale was corrected mid-review — the existing clustered PK already serves the unfiltered case, only the filtered (`categoryId`) query needed a new composite index.
  [`scaling-product-list-pagination.md:83`](../../docs/design/scaling-product-list-pagination.md#L83)

**Layers the design touches beyond the repository snippet**

- `IProductRepository`/`IProductService`/a new `PagedResultDto` all need matching changes per AD-2/AD-9 — called out explicitly so the repository-only code sample doesn't read as the whole change.
  [`scaling-product-list-pagination.md:57`](../../docs/design/scaling-product-list-pagination.md#L57)

- Query-parameter validation via a bound `[Range(1,100)]` DTO, not raw `[FromQuery]` scalars — consistent with AD-8's Data Annotations convention, added after the review flagged the original `limit` clamp as claimed but not actually enforced anywhere.
  [`scaling-product-list-pagination.md:52`](../../docs/design/scaling-product-list-pagination.md#L52)

**Honest consequences (review-added)**

- Frontend refresh-on-delete semantics, sibling `CategoryRepository`'s identical gap, accessibility for paging state, new test surface, and OpenAPI drift — all flagged as real but undesigned, matching this project's established pattern of naming a gap rather than silently ignoring it.
  [`scaling-product-list-pagination.md:94`](../../docs/design/scaling-product-list-pagination.md#L94)

- Breaking-change/versioning tradeoff for changing the response envelope, and rate-limiting as a companion (not substitute) concern.
  [`scaling-product-list-pagination.md:55`](../../docs/design/scaling-product-list-pagination.md#L55)
  [`scaling-product-list-pagination.md:108`](../../docs/design/scaling-product-list-pagination.md#L108)
