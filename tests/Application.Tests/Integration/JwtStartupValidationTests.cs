using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.Tests.Integration;

/// <summary>
/// Code-review finding (2026-08-22): Program.cs's fail-fast Jwt:* config
/// guards (SigningKey length, Issuer, Audience, ExpiryMinutes &lt;= 0) had no
/// test forcing any of them to fire — every other test that boots the app
/// uses appsettings.Development.json's already-valid values, so a
/// regression weakening or dropping a guard would go undetected until a
/// real misconfigured deployment.
///
/// These guards run as top-level statements between WebApplication.CreateBuilder
/// and builder.Build() — before WebApplicationFactory's own
/// ConfigureAppConfiguration hook takes effect (confirmed empirically: an
/// override supplied that way is invisible to code that already ran before
/// Build()). Environment variables are the one config source Program.cs's
/// own CreateBuilder(args) call reads fresh, so setting one before the
/// factory boots the app is the only way to reach these guards without
/// refactoring Program.cs. That makes each test mutate real process-wide
/// state, which is why this class is pinned to the "WebApplicationFactory"
/// collection (DisableParallelization = true, see
/// WebApplicationFactoryCollection.cs) — without it, another integration
/// test class's factory booting concurrently could pick up the same
/// environment variable and fail for an unrelated reason.
/// </summary>
[Collection("WebApplicationFactory")]
public class JwtStartupValidationTests
{
    [Theory]
    [InlineData("Jwt__SigningKey", "too-short")] // under the 32-byte minimum
    [InlineData("Jwt__Issuer", "")]
    [InlineData("Jwt__Audience", "")]
    [InlineData("Jwt__ExpiryMinutes", "0")]
    public void InvalidJwtConfig_ThrowsOnStartup(string envVarName, string invalidValue)
    {
        Environment.SetEnvironmentVariable(envVarName, invalidValue);
        try
        {
            using var factory = new WebApplicationFactory<Program>();

            Assert.ThrowsAny<Exception>(() => factory.Server);
        }
        finally
        {
            Environment.SetEnvironmentVariable(envVarName, null);
        }
    }
}
