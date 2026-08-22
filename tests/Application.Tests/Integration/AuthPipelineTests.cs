using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.IdentityModel.Tokens;

namespace Application.Tests.Integration;

/// <summary>
/// Story 2.2 review finding: no automated test previously exercised the
/// *real* ASP.NET Core authentication pipeline registered in Program.cs (as
/// opposed to JwtTokenGeneratorTests, which validates a
/// TokenValidationParameters object built inline in the test file,
/// independent of what AddJwtBearer actually registers). A regression that
/// silently breaks the pipeline — OnMessageReceived's cookie-extraction
/// typo'd, [Authorize] dropped from AuthController.Me(), or
/// UseAuthentication()/UseAuthorization() reordered or deleted — would not
/// be caught by `dotnet test` before this class existed.
///
/// Uses WebApplicationFactory&lt;Program&gt; (Program.cs now ends with
/// `public partial class Program;` to make the top-level-statements Program
/// class visible to this assembly) to host the app in-process and drive
/// GET /api/auth/me through the real middleware pipeline.
///
/// Deliberately scoped to the two paths that don't require a database:
/// missing cookie and expired-but-correctly-signed cookie. JWT bearer
/// middleware rejects both before any DB-touching code runs, so no SQL
/// Server needs to be reachable for these assertions. The valid-cookie -&gt;
/// 200 path requires a real register+login DB round trip and is out of
/// scope for this class (covered previously by manual verification) —
/// adding it here would require a test-only DB substitution strategy, which
/// is a design decision beyond this patch.
/// </summary>
[Collection("WebApplicationFactory")]
public class AuthPipelineTests : IClassFixture<WebApplicationFactory<Program>>
{
    // Mirrors appsettings.Development.json's "Jwt" section exactly, so a
    // token signed here validates against the TokenValidationParameters
    // Program.cs actually registers when the factory boots the app in the
    // Development environment.
    private const string SigningKey = "kicTMeke3/xJmBp0jQAzz+95w9e6iit/0WO8rHBTVUgB/tZfNdHg8SZAtd9R86kq";
    private const string Issuer = "ASPFullStackBMAD";
    private const string Audience = "ASPFullStackBMAD";

    private readonly WebApplicationFactory<Program> _factory;

    public AuthPipelineTests(WebApplicationFactory<Program> factory)
    {
        // Explicitly Development (not relying on the factory's default) so
        // appsettings.Development.json — which supplies both the
        // ConnectionStrings:DefaultConnection and Jwt sections Program.cs
        // requires at startup — is the config actually loaded.
        _factory = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
    }

    [Fact]
    public async Task GetMe_NoAccessTokenCookie_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await AssertProblemDetailsUnauthorizedAsync(response);
    }

    [Fact]
    public async Task GetMe_ExpiredAccessTokenCookie_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var expiredToken = BuildToken(TimeSpan.FromMinutes(-5));
        client.DefaultRequestHeaders.Add("Cookie", $"access_token={expiredToken}");

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// Code-review finding, 2026-08-22 (verification-gap): the library's
    /// default ClockSkew is a 5-minute leeway, so a token expired exactly at
    /// -5 minutes (the case above) is still rejected under either the
    /// default or Program.cs's ClockSkew = TimeSpan.Zero — it sits right on
    /// the old boundary, not inside the window the two behaviors actually
    /// disagree on. A token expired by -2 minutes is inside that window: it
    /// would be accepted under the library's 5-minute default but must be
    /// rejected under ClockSkew = TimeSpan.Zero. This is the only case that
    /// actually discriminates the two, closing the regression gap where
    /// reverting ClockSkew = TimeSpan.Zero would not fail any existing test.
    /// </summary>
    [Fact]
    public async Task GetMe_AccessTokenExpiredTwoMinutesAgo_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var recentlyExpiredToken = BuildToken(TimeSpan.FromMinutes(-2));
        client.DefaultRequestHeaders.Add("Cookie", $"access_token={recentlyExpiredToken}");

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// Code-review finding, 2026-08-22 (verification-gap): Program.cs's
    /// OnMessageReceived only ever reads the JWT from the access_token
    /// cookie and explicitly calls context.NoResult() when it's absent,
    /// specifically to stop JwtBearerHandler's default Authorization: Bearer
    /// header extraction from running (AD-5: "the JWT travels only as the
    /// httpOnly access_token cookie, never as an Authorization header"). No
    /// test previously sent a validly-signed token via the header with no
    /// cookie present -- reverting that NoResult() call would not have
    /// failed any existing test.
    /// </summary>
    [Fact]
    public async Task GetMe_ValidTokenViaAuthorizationHeaderNoCookie_ReturnsUnauthorized()
    {
        var client = _factory.CreateClient();
        var validToken = BuildToken(TimeSpan.FromMinutes(30));
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", validToken);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private static async Task AssertProblemDetailsUnauthorizedAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(401, body.GetProperty("status").GetInt32());
    }

    /// <summary>
    /// Built directly via JwtSecurityToken (not through JwtTokenGenerator,
    /// whose expiry is always computed forward from DateTime.UtcNow) so the
    /// token's exp claim can be placed at an arbitrary offset from now --
    /// negative for expired, positive for valid -- exercising Program.cs's
    /// ValidateLifetime/ClockSkew and OnMessageReceived through the real
    /// pipeline. Mirrors the construction JwtTokenGeneratorTests.cs already
    /// uses for its own expired-token unit test.
    /// </summary>
    private static string BuildToken(TimeSpan expiresIn)
    {
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: [new Claim(JwtRegisteredClaimNames.Sub, "42")],
            notBefore: DateTime.UtcNow.AddMinutes(-10),
            expires: DateTime.UtcNow.Add(expiresIn),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
