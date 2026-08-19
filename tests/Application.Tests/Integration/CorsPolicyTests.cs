using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.Tests.Integration;

/// <summary>
/// Story 2.3: confirms the CORS policy registered in Program.cs
/// (WithOrigins(Cors:FrontendOrigin) + AllowCredentials(), never
/// AllowAnyOrigin()) actually applies through the real ASP.NET Core
/// pipeline. app.UseCors(...) is global middleware (not a per-endpoint
/// [EnableCors] attribute), so it evaluates the Origin header on every
/// request before routing/auth — GET /api/auth/me is used as the target
/// here specifically because it needs no DB (matching this story's Code Map
/// note that the CORS-header cases don't require any DB-touching code to
/// run; the request being unauthenticated/401 is irrelevant to whether the
/// CORS headers get attached).
///
/// Mirrors AuthPipelineTests's WebApplicationFactory&lt;Program&gt; +
/// WithWebHostBuilder(Development) pattern, since appsettings.Development.json
/// supplies the Cors:FrontendOrigin value (http://localhost:5173) Program.cs
/// requires at startup.
/// </summary>
public class CorsPolicyTests : IClassFixture<WebApplicationFactory<Program>>
{
    private const string ConfiguredFrontendOrigin = "http://localhost:5173";
    private const string DisallowedOrigin = "https://evil.example.com";
    private const string AccessControlAllowOriginHeader = "Access-Control-Allow-Origin";

    private readonly HttpClient _client;

    public CorsPolicyTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();
    }

    [Fact]
    public async Task Get_WithConfiguredFrontendOrigin_ReturnsMatchingAllowOriginHeader()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Add("Origin", ConfiguredFrontendOrigin);

        var response = await _client.SendAsync(request);

        Assert.True(response.Headers.TryGetValues(AccessControlAllowOriginHeader, out var values));
        Assert.Equal(ConfiguredFrontendOrigin, Assert.Single(values!));
    }

    [Fact]
    public async Task Get_WithDisallowedOrigin_OmitsAllowOriginHeader()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Add("Origin", DisallowedOrigin);

        var response = await _client.SendAsync(request);

        Assert.False(response.Headers.Contains(AccessControlAllowOriginHeader));
    }
}
