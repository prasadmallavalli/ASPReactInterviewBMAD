using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Application.Services;
using Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Application.Tests.Services;

/// <summary>
/// Story 2.2: unit tests for JwtTokenGenerator. The expiry test is the
/// automated coverage of FR-4's expiry-enforcement mechanism itself — it
/// mints a token with a past expiry (via a JwtSecurityToken built directly,
/// bypassing GenerateToken's DateTime.UtcNow.AddMinutes(...) which can only
/// produce future expiries) and confirms JwtSecurityTokenHandler.ValidateToken
/// with ValidateLifetime = true rejects it, proving the same validation
/// parameters Program.cs configures actually enforce expiry.
/// </summary>
public class JwtTokenGeneratorTests
{
    private const string SigningKey = "unit-test-signing-key-at-least-256-bits-long-for-hmacsha256!!";
    private const string Issuer = "test-issuer";
    private const string Audience = "test-audience";

    private static JwtTokenGenerator CreateSut(int expiryMinutes = 60)
    {
        var options = Options.Create(new JwtOptions
        {
            SigningKey = SigningKey,
            Issuer = Issuer,
            Audience = Audience,
            ExpiryMinutes = expiryMinutes
        });
        return new JwtTokenGenerator(options);
    }

    private static TokenValidationParameters ValidationParameters() => new()
    {
        ValidateIssuer = true,
        ValidIssuer = Issuer,
        ValidateAudience = true,
        ValidAudience = Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)),
        ValidateLifetime = true
    };

    [Fact]
    public void GenerateToken_ValidUser_ProducesTokenWithSubAndEmailClaimsThatValidatesSuccessfully()
    {
        var sut = CreateSut();
        var user = new User { Id = 42, Email = "foo@x.com", PasswordHash = "hash" };

        var token = sut.GenerateToken(user);

        // MapInboundClaims = false mirrors Program.cs's JwtBearerOptions
        // setting, so Sub/Email round-trip as the literal claim types
        // JwtTokenGenerator minted instead of being remapped to long
        // ClaimTypes URIs by the handler's default inbound claim map.
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        var principal = handler.ValidateToken(token, ValidationParameters(), out _);

        Assert.Equal("42", principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value);
        Assert.Equal("foo@x.com", principal.FindFirst(JwtRegisteredClaimNames.Email)?.Value);
    }

    [Fact]
    public void ValidateToken_ExpiredToken_ThrowsSecurityTokenExpiredException()
    {
        // Built directly (not via GenerateToken, whose expiry is always
        // computed from DateTime.UtcNow forward) so the token's exp claim is
        // deliberately in the past — this is what FR-4 requires be rejected.
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
        var expiredToken = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: [new System.Security.Claims.Claim(JwtRegisteredClaimNames.Sub, "42")],
            notBefore: DateTime.UtcNow.AddMinutes(-10),
            expires: DateTime.UtcNow.AddMinutes(-5),
            signingCredentials: credentials);
        var expiredTokenString = new JwtSecurityTokenHandler().WriteToken(expiredToken);

        var handler = new JwtSecurityTokenHandler();

        Assert.Throws<SecurityTokenExpiredException>(() =>
            handler.ValidateToken(expiredTokenString, ValidationParameters(), out _));
    }
}
