# Deployment (Interview Demo Hosting)

Target: **run everything locally, expose it via a free Cloudflare quick tunnel.** No cloud account, no billing, no region/provisioning issues (an earlier attempt at Azure App Service + Azure SQL hit `RegionDoesNotAllowProvisioning` on a fresh subscription in multiple regions — abandoned in favor of this).

The React SPA is still built and served from the same origin as the API (`Program.cs`'s `UseDefaultFiles`/`UseStaticFiles`, serving `wwwroot`), so the existing `SameSite=Strict` cookie/CSRF design (AD-5, Story 2.3) needs zero changes — same as the original plan, just without a cloud host underneath it.

## One-time setup

- **Docker** running (for the `mssql` service in `docker-compose.yml` — already how local dev works).
- **cloudflared** — no account/signup needed for a quick tunnel. Installed via direct binary download in this session (`~/.local/bin/cloudflared`, since Homebrew wasn't available); if you have Homebrew, `brew install cloudflared` works too.

## Running the demo

```bash
./scripts/run-demo.sh
```

This builds the SPA, copies it into `src/Api/wwwroot`, starts the API, and opens a Cloudflare quick tunnel. It prints a public HTTPS URL like:

```
https://chelsea-disciplines-harley-filing.trycloudflare.com
```

That's the link to share. **It changes every time you re-run the script** — Cloudflare's free quick tunnels don't support a stable/reserved subdomain without a paid domain in your Cloudflare account. Run it shortly before the interview and send the fresh link, rather than putting one URL in a resume/portfolio permanently.

Verified end-to-end this session: register → login → `/me` (mints the CSRF cookie) → create a category, all through the public tunnel URL with real `Secure`/`SameSite=Strict` cookies — the full auth+CSRF flow works exactly as it does locally, because the tunnel presents a real HTTPS origin to the browser.

## Before an actual interview

- **Reset the dev database first if you want a clean demo.** The local dev DB has accumulated test data across many sessions (registrations, categories, products from `dotnet test` runs, manual smoke tests, etc.) — an interviewer will see all of it. Easiest reset: `docker compose down -v && docker compose up -d && dotnet ef database update -p src/Infrastructure -s src/Api` (drops the volume, recreates an empty schema).
- **Keep the terminal running `run-demo.sh` open** for the duration — closing it kills both the API and the tunnel.
- **The tunnel has no uptime guarantee** (Cloudflare's own terms for account-less quick tunnels) — fine for a scheduled demo, not for something meant to stay up unattended for days.

## What's still in the CI/CD pipeline

`.github/workflows/ci-cd.yml` runs `backend` (real SQL Server service container, migrate, `dotnet build`/`dotnet test`) and `frontend` (`npm run lint`/`npm test`/`npm run build`, which also type-checks) on every push/PR. This closes the CI-pipeline gap logged in `docs/eng-mgmt/post-mvp-roadmap.md` regardless of hosting target. There is no `deploy` job — nothing to deploy to automatically when hosting is "run a script on your own machine."

## If you want a real hosted deployment later

The Azure App Service + Azure SQL path is still viable if you want an always-on link — Azure resource group `aspfullstackbmad-rg` was created (empty) during this session's exploration and left in the subscription if you want to pick it back up. It failed on `RegionDoesNotAllowProvisioning` in `eastus`/`eastus2` for Azure SQL specifically; worth trying a different region, a different SQL offering (e.g. SQL Server in a container instead of the Azure SQL Database PaaS product), or filing an Azure support request to lift the restriction on the subscription.
