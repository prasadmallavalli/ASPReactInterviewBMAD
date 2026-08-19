---
title: 'API Client Foundation & Resilience Layer'
type: 'feature'
created: '2026-08-19'
status: 'done'
review_loop_iteration: 0
baseline_commit: '32cfbec3ce6fb3cfd9ea191090c722b30d1a3ddd'
context: ['{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No `client/` project exists yet, and every Epic 3 feature (list/create/edit/delete) will need to call the protected API with cookies included, the CSRF header attached on mutations, and resilience against transient failures — without a shared foundation, each story would reimplement this inconsistently.

**Approach:** Scaffold a React 19 + TypeScript Vite app under `client/`, and build a single `fetch`-based API client module (`client/src/api/`) that includes credentials on every request, attaches `X-CSRF-TOKEN` from the `XSRF-TOKEN` cookie on mutating requests, and retries network/5xx failures with exponential backoff (max 3 attempts, never retrying 4xx) per AD-7.

## Boundaries & Constraints

**Always:**
- Every request sets `credentials: 'include'` so the httpOnly `access_token` cookie rides along automatically.
- POST/PUT/PATCH/DELETE requests read the JS-readable `XSRF-TOKEN` cookie (set by the API's `GET /api/auth/me`, never by `Login`) and attach its value as an `X-CSRF-TOKEN` header; GET requests never attach it.
- Retry only network failures and 5xx responses, exponential backoff, max 3 attempts total; 4xx responses (400/401/404/409, etc.) are never retried (AD-7).
- Vite dev server runs on port 5173 — matches the API's already-configured `Cors:FrontendOrigin`; do not change one without the other.
- API base URL comes from a Vite env var (`VITE_API_BASE_URL`, default `https://localhost:7197`), never hardcoded inline.
- Failures (after retries exhausted, or any 4xx) are surfaced to callers as a typed result carrying the parsed `ProblemDetails` body (`title`/`status`/`detail`) when present — never thrown as opaque strings or swallowed.

**Ask First:** none — `fetch` with zero HTTP-client dependency and Vitest as the test runner (Vite's own zero-config pairing) match this project's established preference for framework-provided pieces over third-party libraries (`AD-8`/`AD-9`).

**Never:**
- Do not build any login/registration/CSRF-bootstrap UI — no story in this epic's list covers auth screens; this client assumes a session already exists and exposes the primitives Stories 3.2–3.5 need.
- Do not implement any Product- or Category-specific request functions (`getProducts`, `createProduct`, etc.) — those belong to Stories 3.2–3.5, which build on this foundation.
- Do not add axios or any other HTTP client library.
- Do not add idempotency-key or dedup logic for retried mutations — AD-7's text retries network/5xx uniformly with no idempotency carve-out; inventing one here would exceed this story's scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| GET request | any GET call | `credentials: 'include'` set; no `X-CSRF-TOKEN` header attached | N/A |
| Mutating request, CSRF cookie present | POST/PUT/PATCH/DELETE, `XSRF-TOKEN` cookie exists | `X-CSRF-TOKEN` header attached with the cookie's value | N/A |
| Network failure | `fetch` throws (offline/DNS/etc.) | Retried up to 3 attempts total with exponential backoff | Typed error result once retries are exhausted |
| 5xx response | Server returns 500–599 | Retried up to 3 attempts total with exponential backoff | Typed error result (parsed `ProblemDetails` if present) once retries are exhausted |
| 4xx response | Server returns 400–499 | Not retried, fails immediately | Typed error result with parsed `ProblemDetails` |
| 2xx response | Server returns 2xx | Parsed JSON body returned as a typed success result (no body assumed on 204) | N/A |

</frozen-after-approval>

## Code Map

- No `client/` directory exists yet -- scaffold fresh via `npm create vite@latest client -- --template react-ts`
- `src/Api/Properties/launchSettings.json` -- HTTPS dev port `7197` -- `VITE_API_BASE_URL` default target
- `src/Api/Program.cs` (CORS setup) -- `Cors:FrontendOrigin=http://localhost:5173`, `AllowCredentials()` -- Vite must run on 5173, credentials required
- `src/Api/Program.cs` (`AddAntiforgery`) -- `options.HeaderName = "X-CSRF-TOKEN"` -- exact header name to send
- `src/Api/Controllers/AuthController.cs` (`Me()`) -- sets the JS-readable `XSRF-TOKEN` cookie (never `Login`) -- cookie name to read
- `ProductsController.cs`/`CategoriesController.cs` -- confirm the RFC 7807 `ProblemDetails` shape (`title`/`status`/`detail`) to parse

## Tasks & Acceptance

**Execution:**
- [x] `client/` (new) -- scaffold via `npm create vite@latest client -- --template react-ts` -- establishes React 19 + TypeScript + Vite per architecture
- [x] `client/vite.config.ts` -- set dev server port explicitly to `5173` -- matches the API's configured `Cors:FrontendOrigin`
- [x] `client/.env` (new, gitignored) + `client/.env.example` -- `VITE_API_BASE_URL=https://localhost:7197` -- externalizes the API base URL per Always
- [x] `client/src/api/cookies.ts` (new) -- `readCookie(name: string): string | null` utility -- source for the CSRF header value
- [x] `client/src/api/client.ts` (new) -- typed `apiFetch` wrapper implementing the full I/O matrix: credentials, CSRF header on mutations, retry/backoff on network/5xx, typed success/error result with `ProblemDetails` parsing -- the foundation itself
- [x] `client/src/api/client.test.ts` (new) -- Vitest unit tests covering every I/O matrix row via a mocked `fetch` -- automated coverage of AD-7 and the CSRF contract
- [x] `client/package.json` -- add `vitest` as a dev dependency and a `test` script -- test runner wiring

**Acceptance Criteria:**
- Given the scaffolded client project, when `npm run build` is run, then it completes with no TypeScript errors
- Given the scaffolded client project, when `npm run dev` is started, then it serves on port 5173, matching the API's CORS configuration
- Given `client/src/api/client.test.ts`, when `npm test` is run, then every test passes

## Spec Change Log

## Design Notes

**Why native `fetch`, no HTTP library, and Vitest:** matches this project's established backend preference for framework-provided pieces over new dependencies (`PasswordHasher<User>`, `JwtBearer`, `IAntiforgery`); `fetch` covers credentials/headers/retry needs, and Vitest is Vite's own zero-config test runner (no separate Jest/Babel setup), with `vi.stubGlobal('fetch', ...)` sufficient to mock the I/O matrix.

**Known accepted risk:** AD-7 retries network/5xx uniformly, including non-idempotent POST/PUT/DELETE — a request that succeeded server-side but lost its response to a network blip could be retried, risking a duplicate. No idempotency-key mechanism exists API-side; out of scope here per the Never boundary, flagged for visibility.

**Planning gap surfaced, not solved here:** no story in the epic list covers a login/registration UI, yet Stories 3.3–3.5 need an authenticated session to demo create/edit/delete through the actual UI. This story only builds the primitives.

## Verification

**Commands:**
- `cd client && npm install` -- expected: installs without error
- `cd client && npm run build` -- expected: TypeScript compiles with no errors
- `cd client && npm test` -- expected: all `client.ts` unit tests pass, covering every I/O matrix row

**Manual checks (if no CLI):**
- Start the API (`dotnet run --launch-profile https` in `src/Api`) and the client (`npm run dev` in `client`) together; from browser devtools, confirm a request through the new client to a public GET endpoint carries `credentials: include` and no `X-CSRF-TOKEN` header.

## Suggested Review Order

**The resilience contract (`apiFetch`)**

- Entry point: request setup (credentials, CSRF header on mutations) before the retry loop.
  [`client.ts:99`](../../client/src/api/client.ts#L99)

- Retry/backoff loop — network failures and 5xx retried, 4xx never retried (AD-7).
  [`client.ts:126`](../../client/src/api/client.ts#L126)

- Success-path body parsing, now guarded so a malformed 2xx body returns a typed failure instead of throwing (review patch).
  [`client.ts:155`](../../client/src/api/client.ts#L155)

- `API_BASE_URL` fallback — now treats a blank env value the same as unset (review patch).
  [`client.ts:50`](../../client/src/api/client.ts#L50)

**CSRF cookie handling**

- `readCookie` — now guards `decodeURIComponent` against malformed encodings (review patch).
  [`cookies.ts:13`](../../client/src/api/cookies.ts#L13)

**Test coverage**

- Retry-then-succeed tests closing the gap where every prior test only exercised the all-attempts-fail path.
  [`client.test.ts`](../../client/src/api/client.test.ts)

- Direct `readCookie` unit tests, added since this module previously had no dedicated coverage.
  [`cookies.test.ts`](../../client/src/api/cookies.test.ts)

**Peripherals**

- Dev server port pinned to match the API's CORS origin.
  [`vite.config.ts`](../../client/vite.config.ts)

- API base URL externalized to an env var.
  [`.env.example`](../../client/.env.example)
