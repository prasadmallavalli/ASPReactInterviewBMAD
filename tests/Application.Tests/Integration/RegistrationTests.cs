using System.Net;
using System.Net.Http.Json;
using Domain.Entities;
using Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Tests.Integration;

/// <summary>
/// Story 2.1 code-review findings (2026-08-22), closing two gaps
/// UserServiceTests/AuthControllerTests couldn't: both classes mock
/// IUserRepository/IUserService, so neither exercises the real EF Core
/// schema or the real ASP.NET Core model-validation pipeline.
/// </summary>
[Collection("WebApplicationFactory")]
public class RegistrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public RegistrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder => builder.UseEnvironment("Development"));
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost")
        });
    }

    /// <summary>
    /// Verification-gap finding: nothing proved the unique index declared in
    /// AppDbContext.OnModelCreating and created by the AddUserEntity
    /// migration actually rejects a duplicate at the DB layer — the
    /// existing service-level duplicate tests never touch a real
    /// AppDbContext. Inserts the same normalized email twice directly
    /// against AppDbContext (bypassing UserService's app-level check
    /// entirely) so only the DB constraint itself is under test. Requires
    /// the local SQL Server from docker-compose.yml to be reachable.
    /// </summary>
    [Fact]
    public async Task DirectDbInsert_DuplicateNormalizedEmail_ThrowsDueToUniqueIndex()
    {
        var email = $"db-unique-{Guid.NewGuid():N}@example.com";
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        try
        {
            db.Users.Add(new User { Email = email, PasswordHash = "hash-1" });
            await db.SaveChangesAsync();

            db.Users.Add(new User { Email = email, PasswordHash = "hash-2" });

            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
        finally
        {
            await db.Users.Where(u => u.Email == email).ExecuteDeleteAsync();
        }
    }

    /// <summary>
    /// Blind-hunter finding: the design relies entirely on [ApiController]'s
    /// automatic Data Annotation validation for malformed registration
    /// payloads, but nothing verified that reliance — a unit test calling
    /// AuthController.Register(...) directly bypasses model-state
    /// validation, since that only runs through the real MVC pipeline. Every
    /// case here fails validation before touching the DB, so no SQL Server
    /// connectivity or cleanup is required.
    /// </summary>
    [Theory]
    [InlineData("valid-400-a@example.com", "")] // missing password
    [InlineData("not-an-email", "ValidPass1")] // malformed email
    [InlineData("valid-400-b@example.com", "short1")] // below the 8-char minimum
    [InlineData("valid-400-c@example.com", "waytoolongpassword123")] // above the 12-char maximum
    public async Task Register_MalformedPayload_ReturnsBadRequest(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new { email, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
