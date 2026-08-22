using System.Text;
using Api.Middleware;
using Application.Services;
using Domain.Entities;
using Domain.Interfaces;
using Infrastructure;
using Infrastructure.Data;
using Infrastructure.Repositories;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Validate DI scopes/build in every environment, not just Development's
// default — this is the exact check that would have caught Story 1.5's
// Singleton-capturing-Scoped bug at startup instead of under concurrent
// production load. Added during Story 1.5's review as a permanent guard
// against this bug class recurring.
builder.Host.UseDefaultServiceProvider(options =>
{
    options.ValidateScopes = true;
    options.ValidateOnBuild = true;
});

// Add services to the container.

// AutoValidateAntiforgeryTokenAttribute applied globally (Story 2.3) rather
// than per-action: it only validates unsafe HTTP methods (POST/PUT/DELETE/
// PATCH), so GET actions need no explicit exemption, and Register/Login
// (the two endpoints that must NOT be CSRF-checked, since no session exists
// yet to protect) opt out individually via [IgnoreAntiforgeryToken]
// (AuthController).
builder.Services.AddControllers(options =>
    options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute()));

// AutoValidateAntiforgeryTokenAttribute is an IFilterFactory that resolves
// AutoValidateAntiforgeryTokenAuthorizationFilter from DI, but that filter
// type is only registered by Microsoft.AspNetCore.Mvc.ViewFeatures's
// AddViewServices — normally pulled in transitively by
// AddControllersWithViews()/AddRazorPages(), neither of which a views-free
// Web API calls. Bare AddControllers() above never registers it, which
// throws InvalidOperationException at request time otherwise.
// AddMvcCore().AddViews() (chained separately since AddControllers()
// returns IMvcBuilder, and AddViews() is only defined on IMvcCoreBuilder —
// both share/compose onto the same IServiceCollection via TryAdd* the same
// way AddControllersWithViews() does internally) adds exactly the missing
// filter/antiforgery registrations, WITHOUT pulling in Razor view
// compilation (that's .AddRazorViewEngine(), deliberately not called here).
// Still ships in the shared framework (Microsoft.AspNetCore.Mvc.ViewFeatures
// .dll) — zero new NuGet packages, consistent with this story's IAntiforgery
// choice.
builder.Services.AddMvcCore().AddViews();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// RFC 7807 ProblemDetails envelope for every 4xx/5xx response, including the
// automatic 400s [ApiController] produces on model-state failures — one
// consistent error shape across the whole API (Epic 1 requirement).
builder.Services.AddProblemDetails();

// Infrastructure is referenced only here (composition root), never from a
// controller — AD-1. AppDbContext is registered Scoped by AddDbContext's
// default, matching AD-4 (DbContext must never be captured as Singleton).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Missing 'ConnectionStrings:DefaultConnection'. Local dev supplies it via appsettings.Development.json.");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connectionString));

// Repositories/UnitOfWork/services are all Scoped (AD-4) — they either hold a
// Scoped AppDbContext (repositories, UnitOfWork) or are cheap to recreate
// per-request with no reason to outlive it (services).
builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
// Deliberately registered AddSingleton once (Story 1.5) to reproduce the
// captive-dependency failure AD-4 forbids: a Singleton repository holding a
// Scoped AppDbContext gets one DbContext instance captured for the app's
// whole lifetime, and DbContext is not thread-safe, so concurrent requests
// race and throw. Observed, logged with a correlation ID, and saved verbatim
// at _bmad-output/implementation-artifacts/story-1-5-di-bug-log-excerpt.md
// for the later FR9 postmortem. Reverted to AddScoped here — AD-4 holds with
// no standing exception.
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();

// PasswordHasher<User> is framework-provided and stateless (AD-4) — safe as
// a Singleton, unlike the DbContext-touching repositories/UnitOfWork/services
// above, which must stay Scoped.
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

// Jwt:* is read from config once, into a single validated JwtOptions
// instance, mirroring the connection-string null-guard above — a missing or
// malformed value fails fast at startup rather than producing a confusing
// runtime failure (or, worse, silently-expired tokens) the first time a
// token is minted or validated. This same instance both configures
// TokenValidationParameters below and backs the Configure<JwtOptions> binding
// JwtTokenGenerator consumes via IOptions<JwtOptions> — there is exactly one
// read of the "Jwt" config section, not two independent ones.
var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.Configure<JwtOptions>(jwtSection);

var jwtOptions = jwtSection.Get<JwtOptions>()
    ?? throw new InvalidOperationException(
        "Missing 'Jwt' configuration section. Local dev supplies it via appsettings.Development.json.");

if (string.IsNullOrWhiteSpace(jwtOptions.SigningKey))
{
    throw new InvalidOperationException(
        "Missing 'Jwt:SigningKey'. Local dev supplies it via appsettings.Development.json.");
}

if (Encoding.UTF8.GetByteCount(jwtOptions.SigningKey) < 32)
{
    throw new InvalidOperationException(
        "'Jwt:SigningKey' must be at least 32 bytes (256 bits) long for HMACSHA256.");
}

if (string.IsNullOrWhiteSpace(jwtOptions.Issuer))
{
    throw new InvalidOperationException("Missing 'Jwt:Issuer'.");
}

if (string.IsNullOrWhiteSpace(jwtOptions.Audience))
{
    throw new InvalidOperationException("Missing 'Jwt:Audience'.");
}

if (jwtOptions.ExpiryMinutes <= 0)
{
    throw new InvalidOperationException(
        "'Jwt:ExpiryMinutes' must be greater than 0.");
}

// AD-5: the JWT travels only as the httpOnly access_token cookie set by
// AuthController.Login, never as an Authorization header — OnMessageReceived
// reads it from there instead of the default header-based extraction, and
// explicitly short-circuits (NoResult()) when the cookie is absent so
// JwtBearerHandler's own Authorization-header fallback never runs either
// (code-review finding, 2026-08-22: the fallback was previously still live).
// MapInboundClaims = false keeps JwtRegisteredClaimNames.Sub/.Email as the
// literal claim types on ClaimsPrincipal, matching what JwtTokenGenerator
// mints and what AuthController.Me reads back, instead of ASP.NET Core's
// default remapping to long http://schemas... ClaimTypes URIs.
// ValidateLifetime = true is set explicitly (not just left at its default);
// ClockSkew = TimeSpan.Zero (code-review finding, 2026-08-22) removes the
// library's default 5-minute leeway so FR-4's "expired token is rejected,
// not silently accepted" holds exactly at the token's own exp claim, not up
// to 5 minutes past it.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.TryGetValue("access_token", out var accessToken))
                {
                    context.Token = accessToken;
                }
                else
                {
                    context.NoResult();
                }

                return Task.CompletedTask;
            },
            // Default challenge writes a bodyless 401 — replaced with the
            // same ProblemDetails envelope every other 4xx/5xx in this API
            // uses (Epic 1 requirement; epic-2-context.md restates it for
            // auth errors specifically). Code-review finding, 2026-08-22,
            // confirmed empirically via curl: the default response had
            // content-length: 0.
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/problem+json";

                var problemDetailsService = context.HttpContext.RequestServices
                    .GetRequiredService<IProblemDetailsService>();
                await problemDetailsService.WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = new ProblemDetails
                    {
                        Status = StatusCodes.Status401Unauthorized,
                        Title = "Unauthorized"
                    }
                });
            }
        };
    });
builder.Services.AddAuthorization();

// Cors:FrontendOrigin is read once here and fails fast at startup if
// missing or blank, mirroring the Jwt:*/connection-string null-guard pattern
// above — a missing value should never silently fall through to a permissive
// or broken CORS policy. Default (http://localhost:5173, Vite's dev port) is
// supplied by appsettings.Development.json.
// Code-review finding, 2026-08-22: the original `?? throw` only rejected a
// missing key, not an empty/whitespace one — unlike every Jwt:* guard above,
// which uses IsNullOrWhiteSpace. An empty string would have passed silently
// and produced a CORS policy matching no real Origin header, breaking the
// frontend with no fail-fast diagnostic.
const string CorsPolicyName = "FrontendOnly";
var corsOrigin = builder.Configuration["Cors:FrontendOrigin"];
if (string.IsNullOrWhiteSpace(corsOrigin))
{
    throw new InvalidOperationException(
        "Missing 'Cors:FrontendOrigin'. Local dev supplies it via appsettings.Development.json.");
}

// WithOrigins(...) (never AllowAnyOrigin()) + AllowCredentials() — required
// together, since AllowCredentials() is rejected by the CORS spec when
// combined with a wildcard origin, and cookies (access_token, XSRF-TOKEN)
// won't cross origins without it (Story 2.3, AD-5).
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
        policy.WithOrigins(corsOrigin)
            .AllowCredentials()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

// IAntiforgery (part of the ASP.NET Core shared framework — no new package,
// same reasoning as PasswordHasher<User>/JwtBearer).
//
// Deliberately NOT setting options.Cookie.Name/HttpOnly here: this
// framework-managed cookie carries the "cookie token" half of the antiforgery
// pair, which the client must never read or echo back — only the server-side
// validator (ValidateRequestAsync) ever compares it against the "request
// token". Confirmed empirically while wiring this up: naming this cookie
// "XSRF-TOKEN" + HttpOnly=false and having AuthController.Login echo its
// *cookie-token* value back as X-CSRF-TOKEN produces
// AntiforgeryValidationException: "The cookie token and the request token
// were swapped" on every mutation — the two tokens are cryptographically
// related but deliberately NOT interchangeable strings. It keeps its
// framework-default name and default HttpOnly=true (JS never touches it).
// Cookie.SecurePolicy/SameSite are still hardened here for defense in depth
// even though this cookie is never JS-readable.
//
// The distinct, JS-readable cookie the SPA actually reads and echoes back as
// X-CSRF-TOKEN is "XSRF-TOKEN", populated in AuthController.Login from
// GetAndStoreTokens(...).RequestToken — see the comment there.
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
});

var app = builder.Build();

// Azure App Service (and most PaaS hosts) terminate TLS at their own
// reverse proxy and forward the request to Kestrel as plain HTTP, adding
// X-Forwarded-Proto/X-Forwarded-For headers to say what the client actually
// used. Without this, UseHttpsRedirection() below sees an "http" request
// that's really already https, redirects to https, the proxy forwards that
// as http again, and the client loops. Must run before anything that reads
// Request.Scheme/IsHttps -- placed first, before even the correlation-ID
// middleware, so its own logs reflect the real scheme too. A no-op locally
// (no reverse proxy sends these headers in local dev).
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Deploy-target auto-migration: applies any pending EF Core migrations at
// startup so a fresh deployment (no interactive terminal to run
// `dotnet ef database update` by hand) ends up with a live schema. Gated to
// skip Development specifically because that's the one environment
// WebApplicationFactory<Program>-based integration tests boot the host
// under (AuthPipelineTests/MutationEndpointsAuthTests explicitly call
// .UseEnvironment("Development")) — those tests deliberately need no
// reachable database for their DB-free assertions, and this call would
// force one. Local dev keeps using the existing manual
// `dotnet ef database update` workflow (spec-1-1) unchanged.
if (!app.Environment.IsDevelopment())
{
    using var migrationScope = app.Services.CreateScope();
    migrationScope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();
}

// Configure the HTTP request pipeline.
// CorrelationIdMiddleware is registered FIRST (outermost) so it wraps
// UseExceptionHandler() too, not the other way around. Middleware order is
// outer-to-inner by registration order: if the exception handler were
// registered first, an exception thrown downstream would unwind past (and
// close) CorrelationIdMiddleware's logger scope before ever reaching the
// exception handler's own catch block and its unhandled-exception log line
// — the single log line a postmortem would most need tied to a correlation
// ID. Registering this middleware first keeps that catch block, and its
// logging, inside the scope (Story 1.4 review finding, confirmed against
// ASP.NET Core's ExceptionHandlerMiddlewareImpl source).
app.UseMiddleware<CorrelationIdMiddleware>();

// AddProblemDetails() alone only reshapes responses that already carry a
// 4xx/5xx status (e.g. [ApiController]'s automatic 400, or an explicit
// Conflict()/NotFound() result) — it does not catch unhandled exceptions.
// UseExceptionHandler() closes that gap so every 5xx also gets the
// ProblemDetails envelope, matching the Epic 1 "all 4xx/5xx" requirement.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Serves the built React SPA (client/dist, copied into wwwroot by
// scripts/run-demo.sh before this process starts) from the same origin as
// the API — a deliberate demo-hosting choice (docs/deployment.md: a local
// run exposed via a Cloudflare quick tunnel, no cloud account) to keep the
// frontend and API same-site, so the existing SameSite=Strict cookie/CSRF
// design needs zero rework. UseDefaultFiles() serves wwwroot/index.html for
// `GET /`; no MapFallbackToFile is needed since this app has no
// client-side routing (no react-router) for deep-link paths to fall back
// for. wwwroot's directory always exists (wwwroot/.gitkeep is tracked --
// ASP.NET Core's Static Web Assets loader throws at startup if it's
// physically absent), but is otherwise empty in ordinary `dotnet run`/test
// use — Vite's dev server (localhost:5173) remains the actual local
// frontend outside of a run-demo.sh session.
app.UseDefaultFiles();
app.UseStaticFiles();

// Must run between UseHttpsRedirection() and UseAuthentication() — the
// documented required order for CORS to apply before auth/authorization
// short-circuits a request (Story 2.3).
app.UseCors(CorsPolicyName);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Makes the top-level-statements Program class visible to
// WebApplicationFactory<Program> from the test assembly (Story 2.2 review
// finding: no automated coverage previously exercised the real ASP.NET Core
// authentication pipeline — see tests/Application.Tests/Integration/AuthPipelineTests.cs).
public partial class Program;
