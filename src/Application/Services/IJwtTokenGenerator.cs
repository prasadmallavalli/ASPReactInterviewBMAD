using Domain.Entities;

namespace Application.Services;

/// <summary>
/// Mints a signed JWT for an authenticated user. Depends only on
/// IOptions&lt;JwtOptions&gt; (a plain POCO) and System.IdentityModel.Tokens.Jwt
/// — no EF Core, no ASP.NET hosting types — so it satisfies AD-2 the same
/// way IPasswordHasher&lt;User&gt; usage did in Story 2.1. Lives in
/// Application, not Api, for that reason.
/// </summary>
public interface IJwtTokenGenerator
{
    /// <summary>
    /// Builds a signed JWT carrying JwtRegisteredClaimNames.Sub (the user's
    /// Id) and .Email claims, consistent with how AuthController's /me
    /// action reads claims back out.
    /// </summary>
    string GenerateToken(User user);
}

/// <summary>
/// Config shape bound from the "Jwt" configuration section
/// (appsettings.Development.json) via Configure&lt;JwtOptions&gt; in
/// Program.cs, the composition root. A missing SigningKey fails fast at
/// startup, mirroring the existing connection-string null-guard.
/// </summary>
public class JwtOptions
{
    public required string SigningKey { get; set; }

    public required string Issuer { get; set; }

    public required string Audience { get; set; }

    /// <summary>
    /// No PRD/architecture text specifies a duration; defaults to 60 in
    /// appsettings.Development.json — a cheaply tunable config value, not an
    /// architectural commitment.
    /// </summary>
    public int ExpiryMinutes { get; set; }
}
