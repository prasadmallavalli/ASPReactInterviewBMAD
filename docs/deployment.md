# Deployment (Interview Demo Hosting)

Target: **Azure App Service + Azure SQL Database (free tier)**, same-origin. The React SPA is built and copied into the API's `wwwroot` by the CI/CD pipeline (`.github/workflows/ci-cd.yml`) before publish, so the frontend and API are served from the same domain — the existing `SameSite=Strict` cookie/CSRF design (AD-5, Story 2.3) needs zero changes.

Code/config side is done. This doc is the checklist for the Azure/GitHub side, which needs a human at the keyboard (account creation, resource provisioning, secrets).

## 1. Create the Azure resources

```bash
az login

# Resource group
az group create --name aspfullstackbmad-rg --location eastus

# Azure SQL logical server + free-tier database
az sql server create \
  --name aspfullstackbmad-sql \
  --resource-group aspfullstackbmad-rg \
  --location eastus \
  --admin-user sqladmin \
  --admin-password '<choose a strong password>'

az sql server firewall-rule create \
  --resource-group aspfullstackbmad-rg \
  --server aspfullstackbmad-sql \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0

az sql db create \
  --resource-group aspfullstackbmad-rg \
  --server aspfullstackbmad-sql \
  --name ASPFullStackBMAD \
  --use-free-limit --free-limit-exhaustion-behavior AutoPause

# App Service plan + web app (Linux, .NET 10)
az appservice plan create \
  --name aspfullstackbmad-plan \
  --resource-group aspfullstackbmad-rg \
  --sku F1 --is-linux

az webapp create \
  --name <pick-a-globally-unique-name> \
  --resource-group aspfullstackbmad-rg \
  --plan aspfullstackbmad-plan \
  --runtime "DOTNETCORE:10.0"
```

If `DOTNETCORE:10.0` isn't yet listed as an available runtime stack (`az webapp list-runtimes --os linux`), fall back to `DOTNETCORE:9.0` and republish the API targeting net9.0, or deploy a self-contained build instead — framework-dependent deploy needs the matching runtime stack to exist on the platform.

## 2. Configure App Service settings

In the Azure Portal (App Service → Configuration → Application settings) or via CLI, set:

| Setting | Value |
|---|---|
| `ConnectionStrings__DefaultConnection` | `Server=tcp:aspfullstackbmad-sql.database.windows.net,1433;Database=ASPFullStackBMAD;User Id=sqladmin;Password=<the password from step 1>;TrustServerCertificate=False;Encrypt=True;` |
| `Jwt__SigningKey` | A real random secret, **32+ bytes**, different from the local dev one (never reuse `appsettings.Development.json`'s key — that file is gitignored precisely because it holds dev-only secrets). Generate one: `openssl rand -base64 48` |
| `Jwt__Issuer` | `ASPFullStackBMAD` |
| `Jwt__Audience` | `ASPFullStackBMAD` |
| `Jwt__ExpiryMinutes` | `60` |
| `Cors__FrontendOrigin` | `https://<your-app-name>.azurewebsites.net` (the app's own URL — harmless for same-origin requests, but the startup guard requires *some* value) |

`ASPNETCORE_ENVIRONMENT` defaults to `Production` on App Service — that's what gates `Program.cs`'s auto-migration-on-startup and the `UseForwardedHeaders` TLS-loop fix to actually run. Don't override it.

```bash
az webapp config appsettings set \
  --name <your-app-name> --resource-group aspfullstackbmad-rg \
  --settings \
    ConnectionStrings__DefaultConnection="<value from table>" \
    Jwt__SigningKey="<generated secret>" \
    Jwt__Issuer="ASPFullStackBMAD" \
    Jwt__Audience="ASPFullStackBMAD" \
    Jwt__ExpiryMinutes="60" \
    Cors__FrontendOrigin="https://<your-app-name>.azurewebsites.net"
```

## 3. Wire up GitHub Actions

1. Download the publish profile: App Service → Overview → **Get publish profile** (downloads an XML file).
2. In the GitHub repo: **Settings → Secrets and variables → Actions**.
   - **Secret** `AZURE_WEBAPP_PUBLISH_PROFILE` — paste the full contents of the downloaded XML file.
   - **Variable** `AZURE_APP_NAME` — the App Service name you picked (e.g. `aspfullstackbmad-demo`).
3. Push to `main` (or re-run the workflow manually from the Actions tab). The `deploy` job only runs on a push to `main`, after `backend` and `frontend` both pass.

## 4. Smoke test

Once the workflow's `deploy` job succeeds:

- `https://<your-app-name>.azurewebsites.net/` loads the React app (not a 404).
- Register a user, log in, create/edit/delete a product — the full auth + CRUD flow, live.
- `https://<your-app-name>.azurewebsites.net/api/categories` returns `[]` or real data (confirms the API + DB connection independently of the SPA).

If registration/login fails specifically, the most likely cause is `Jwt__SigningKey` too short (<32 bytes) or `ConnectionStrings__DefaultConnection` wrong — both fail fast at startup with a clear `InvalidOperationException` in the App Service log stream (`az webapp log tail --name <your-app-name> --resource-group aspfullstackbmad-rg`).

## What the CI/CD pipeline does

`.github/workflows/ci-cd.yml` — on every push/PR: `backend` job boots a real SQL Server service container, applies migrations, runs `dotnet build`/`dotnet test`; `frontend` job runs `npm run lint`/`npm test`/`npm run build` (which also type-checks via `tsc -b`). On a push to `main`, once both pass, `deploy` rebuilds the frontend, copies it into `src/Api/wwwroot`, publishes the API, and deploys to Azure App Service via the publish profile.

This also closes the CI-pipeline gap logged in `docs/eng-mgmt/post-mvp-roadmap.md` ("a CI pipeline running `dotnet build`/`dotnet test` on every change... and `npm run build`/`npm test` alongside it") — no workflow existed before this one.
