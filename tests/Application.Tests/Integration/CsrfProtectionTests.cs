using System.Net;
using System.Net.Http.Json;
using Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Tests.Integration;

/// <summary>
/// Story 2.3: end-to-end coverage of the full CSRF-protection flow through
/// the real ASP.NET Core pipeline (WebApplicationFactory, mirroring
/// AuthPipelineTests/MutationEndpointsAuthTests' pattern), exercising the
/// login → GET /api/auth/me → mutation sequence a real frontend must follow
/// — unlike AuthPipelineTests, which deliberately stays DB-free, this class
/// requires the local SQL Server from docker-compose.yml to be reachable
/// (real register + login + category-insert DB round trips), so it cleans
/// up every row it creates in a `finally` block.
///
/// Exists specifically to catch the regression found during this story's
/// manual verification: the original design had Login itself call
/// IAntiforgery.GetAndStoreTokens(HttpContext), which is unconditionally
/// bound to HttpContext.User's authenticated identity AT ISSUANCE TIME —
/// but Login's own incoming request is by definition unauthenticated (no
/// access_token cookie exists yet), so a token minted there is bound to "no
/// identity" and every later (authenticated) mutation request fails
/// validation with "the provided antiforgery token was meant for a
/// different claims-based user than the current user," regardless of the
/// header sent. Fixed by moving token issuance to the [Authorize]-protected
/// GET /api/auth/me instead, which only ever runs already-authenticated —
/// this test would catch a regression back to the broken Login-issues-token
/// design, since that design makes the final "mutation with correct header"
/// assertion below fail with 400 instead of succeeding.
/// </summary>
[Collection("WebApplicationFactory")]
public class CsrfProtectionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public CsrfProtectionTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));

        // BaseAddress = https:// so HttpContext.Request.IsHttps is true for
        // every request TestServer handles in-process — no real TLS
        // handshake happens (this never leaves the process), but it
        // satisfies AntiforgeryOptions.Cookie.SecurePolicy = Always's
        // DefaultAntiforgery.CheckSSLConfig check the same way a real
        // https://localhost:7197 request does, without needing the
        // self-signed dev cert this test run wouldn't have access to.
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    [Fact]
    public async Task RegisterLoginMeThenMutate_NoCsrfHeader400_CorrectCsrfHeaderSucceeds()
    {
        var email = $"csrf-flow-{Guid.NewGuid():N}@example.com";
        // 12 chars: fits the [StringLength(12, MinimumLength = 8)] bound
        // added to UserRegistrationRequestDto.Password (code review, 2026-08-22).
        const string password = "correcthorse";
        var categoryName = $"CSRF Flow Test Category {Guid.NewGuid():N}";
        var createdCategoryId = (int?)null;

        try
        {
            var registerResponse = await _client.PostAsJsonAsync(
                "/api/auth/register", new { email, password });
            Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

            var loginResponse = await _client.PostAsJsonAsync(
                "/api/auth/login", new { email, password });
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
            Assert.True(HasCookieNamed(loginResponse, "access_token"),
                "Login must still set the access_token cookie.");
            Assert.False(HasCookieNamed(loginResponse, "XSRF-TOKEN"),
                "Login must NOT set XSRF-TOKEN anymore — issuance moved to Me() (Story 2.3 fix).");

            // The default HttpClientHandler's CookieContainer automatically
            // resends the access_token cookie Login just set on every
            // subsequent request through this same HttpClient — no manual
            // Cookie header wiring needed, matching real browser behavior.
            var meResponse = await _client.GetAsync("/api/auth/me");
            Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
            var csrfToken = ExtractCookieValue(meResponse, "XSRF-TOKEN");
            Assert.False(string.IsNullOrEmpty(csrfToken),
                "Me() must set XSRF-TOKEN now that issuance has moved here.");

            var noHeaderResponse = await _client.PostAsJsonAsync(
                "/api/categories", new { name = categoryName });
            Assert.Equal(HttpStatusCode.BadRequest, noHeaderResponse.StatusCode);

            using var withHeaderRequest = new HttpRequestMessage(HttpMethod.Post, "/api/categories")
            {
                Content = JsonContent.Create(new { name = categoryName })
            };
            withHeaderRequest.Headers.Add("X-CSRF-TOKEN", csrfToken);
            var withHeaderResponse = await _client.SendAsync(withHeaderRequest);

            Assert.Equal(HttpStatusCode.Created, withHeaderResponse.StatusCode);
            var created = await withHeaderResponse.Content.ReadFromJsonAsync<CategoryDtoShape>();
            Assert.NotNull(created);
            Assert.Equal(categoryName, created!.Name);
            createdCategoryId = created.Id;
        }
        finally
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            if (createdCategoryId is { } categoryId)
            {
                await db.Categories.Where(c => c.Id == categoryId).ExecuteDeleteAsync();
            }

            await db.Users.Where(u => u.Email == email).ExecuteDeleteAsync();
        }
    }

    private static bool HasCookieNamed(HttpResponseMessage response, string cookieName) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
        && values.Any(v => v.StartsWith(cookieName + "=", StringComparison.Ordinal));

    private static string ExtractCookieValue(HttpResponseMessage response, string cookieName)
    {
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out var values), "No Set-Cookie header present.");
        var cookieHeader = values!.Single(v => v.StartsWith(cookieName + "=", StringComparison.Ordinal));
        var valueAndAttributes = cookieHeader[(cookieName.Length + 1)..];
        var semicolonIndex = valueAndAttributes.IndexOf(';');
        return semicolonIndex >= 0 ? valueAndAttributes[..semicolonIndex] : valueAndAttributes;
    }

    // Mirrors just the fields this test needs from CategoryDto, avoiding a
    // dependency on Application.DTOs' exact shape for a single test's
    // deserialization target.
    private sealed class CategoryDtoShape
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
    }
}
