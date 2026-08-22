using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.Tests.Integration;

/// <summary>
/// Story 2.3: confirms [Authorize] actually gates Category/Product
/// Create/Update/Delete through the real ASP.NET Core pipeline (not just
/// that the attribute is present in source), while GET stays public per
/// FR-4's mutation-only scope.
///
/// Mirrors AuthPipelineTests's WebApplicationFactory&lt;Program&gt; +
/// WithWebHostBuilder(Development) pattern. The POST/PUT/DELETE cases send
/// no cookie at all, so the JWT bearer middleware's 401 challenge fires
/// before any DB-touching code in the controller/service runs — no request
/// body is needed either, since authorization is evaluated before model
/// binding. The GET cases exercise the real (unauthenticated,
/// unauthorized-attribute-free) read path end-to-end, which requires the
/// local SQL Server from docker-compose.yml to be reachable, matching how
/// GetAll() behaves in the real running app.
/// </summary>
[Collection("WebApplicationFactory")]
public class MutationEndpointsAuthTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public MutationEndpointsAuthTests(WebApplicationFactory<Program> factory)
    {
        // Explicitly Development (not relying on the factory's default) so
        // appsettings.Development.json — which supplies the
        // ConnectionStrings:DefaultConnection, Jwt, and Cors sections
        // Program.cs requires at startup — is the config actually loaded.
        _client = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();
    }

    private static StringContent EmptyJsonBody() => new("{}", Encoding.UTF8, "application/json");

    [Theory]
    [InlineData("/api/categories")]
    [InlineData("/api/products")]
    public async Task Post_NoAccessTokenCookie_ReturnsUnauthorized(string route)
    {
        var response = await _client.PostAsync(route, EmptyJsonBody());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/categories/1")]
    [InlineData("/api/products/1")]
    public async Task Put_NoAccessTokenCookie_ReturnsUnauthorized(string route)
    {
        var response = await _client.PutAsync(route, EmptyJsonBody());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/categories/1")]
    [InlineData("/api/products/1")]
    public async Task Delete_NoAccessTokenCookie_ReturnsUnauthorized(string route)
    {
        var response = await _client.DeleteAsync(route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/categories")]
    [InlineData("/api/products")]
    public async Task Get_NoAccessTokenCookie_ReturnsOk(string route)
    {
        var response = await _client.GetAsync(route);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
