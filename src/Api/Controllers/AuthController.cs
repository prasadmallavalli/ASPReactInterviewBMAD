using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Application.DTOs;
using Application.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Depends only on IUserService (AD-1) — never IUserRepository, DbContext,
/// or IPasswordHasher directly. [ApiController] gives automatic 400 +
/// ValidationProblemDetails on Data Annotation failures (AD-8:
/// [Required]/[EmailAddress] on UserRegistrationRequestDto), so malformed
/// payload validation never needs to be written by hand here — only the
/// duplicate-email check (a DB lookup, not expressible as an attribute) is
/// handled explicitly below.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IAntiforgery _antiforgery;

    public AuthController(IUserService userService, IAntiforgery antiforgery)
    {
        _userService = userService;
        _antiforgery = antiforgery;
    }

    /// <summary>
    /// [IgnoreAntiforgeryToken]: CSRF protection guards an existing
    /// authenticated session; no session (and therefore no CSRF token) exists
    /// yet at registration time, so validating one here would be a
    /// chicken-and-egg deadlock (Story 2.3).
    /// </summary>
    [HttpPost("register")]
    [IgnoreAntiforgeryToken]
    public async Task<ActionResult<UserDto>> Register(UserRegistrationRequestDto request, CancellationToken cancellationToken)
    {
        var (result, user) = await _userService.RegisterAsync(request, cancellationToken);
        if (result == UserRegistrationResult.EmailAlreadyExists)
        {
            // Problem() (not a hand-built ProblemDetails) so the registered
            // AddProblemDetails() customization is applied consistently,
            // matching ProductsController/CategoriesController.
            return Problem(
                title: "Email already registered",
                statusCode: StatusCodes.Status409Conflict);
        }

        return StatusCode(StatusCodes.Status201Created, user);
    }

    /// <summary>
    /// The JWT is delivered ONLY as a cookie (AD-5) — the raw token string
    /// never appears in the response body, only { id, email }. Wrong
    /// password and unknown email both collapse to the same generic 401
    /// "Invalid credentials" Problem() (UserLoginResult.InvalidCredentials),
    /// so no enumeration signal escapes here either.
    ///
    /// [IgnoreAntiforgeryToken]: same chicken-and-egg reasoning as Register —
    /// no session exists yet to protect, and the client can't have a CSRF
    /// token before this call succeeds.
    ///
    /// Story 2.3 deviation from the original spec text (approved after
    /// verification, see below): the spec originally called for
    /// GetAndStoreTokens(HttpContext) to be called HERE, right after the
    /// access_token cookie is set. That does not work: ASP.NET Core's
    /// DefaultAntiforgery unconditionally binds every issued token to
    /// HttpContext.User's authenticated identity AT ISSUANCE TIME (confirmed
    /// via reflection — AntiforgeryOptions exposes no toggle to disable
    /// this), and the very request running Login is, by definition,
    /// unauthenticated (no access_token cookie was sent on the way in —
    /// that's the same chicken-and-egg reason [IgnoreAntiforgeryToken] is
    /// needed here at all). A token minted mid-Login is therefore bound to
    /// "no identity," while every later mutation request IS authenticated —
    /// a mismatch that made EVERY subsequent mutation fail validation with
    /// "the provided antiforgery token was meant for a different
    /// claims-based user than the current user," regardless of what header
    /// was sent. Verified empirically against a real HTTPS run before this
    /// was moved. CSRF-token issuance now happens in Me() instead (see its
    /// doc comment) — the client must call GET /api/auth/me once after a
    /// successful login, before its first mutation, to receive a correctly
    /// identity-bound XSRF-TOKEN cookie.
    /// </summary>
    [HttpPost("login")]
    [IgnoreAntiforgeryToken]
    public async Task<ActionResult<UserDto>> Login(UserLoginRequestDto request, CancellationToken cancellationToken)
    {
        var (result, token, user) = await _userService.LoginAsync(request, cancellationToken);
        if (result == UserLoginResult.InvalidCredentials)
        {
            return Problem(
                title: "Invalid credentials",
                statusCode: StatusCodes.Status401Unauthorized);
        }

        // No explicit Expires: the cookie is session-scoped (cleared when
        // the browser closes) so it never needs to be kept in sync with the
        // JWT's own exp claim, which remains the sole server-side authority.
        Response.Cookies.Append("access_token", token!, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict
        });

        return Ok(user);
    }

    /// <summary>
    /// [Authorize]-protected endpoint proving the login/JWT/cookie round
    /// trip works end-to-end, including FR-4's "expired token is rejected"
    /// criterion. Reads Sub/Email back via JwtRegisteredClaimNames, matching
    /// JwtTokenGenerator's claim types exactly since Program.cs sets
    /// MapInboundClaims = false. A validly signed token missing either claim
    /// (which should never happen given JwtTokenGenerator always mints both,
    /// but isn't guaranteed by the token's signature alone) is treated as
    /// unauthenticated rather than throwing an unhandled exception.
    ///
    /// Story 2.3: also issues the CSRF token here rather than in Login (see
    /// Login's doc comment for why) — being [Authorize]-protected, this
    /// action only ever runs once HttpContext.User is the SAME authenticated
    /// identity every later mutation request will present, so
    /// GetAndStoreTokens(HttpContext) here mints a token correctly bound to
    /// that identity. Being GET, this endpoint is itself inherently exempt
    /// from AutoValidateAntiforgeryTokenAttribute (which only checks unsafe
    /// methods) — no [IgnoreAntiforgeryToken] needed. The frontend must call
    /// this endpoint once after a successful login (e.g. as its "who am I"
    /// bootstrap call), before attempting any mutation, to receive the
    /// XSRF-TOKEN cookie.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public ActionResult<UserDto> Me()
    {
        var sub = User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var email = User.FindFirstValue(JwtRegisteredClaimNames.Email);

        if (!int.TryParse(sub, out var id) || email is null)
        {
            return Unauthorized();
        }

        // GetAndStoreTokens sets the framework's own (HttpOnly, JS-invisible)
        // antiforgery cookie as a side effect — that cookie carries the
        // "cookie token" half of the pair, which must stay opaque to the
        // client. tokens.RequestToken is the OTHER half: the value the
        // client is meant to echo back verbatim as the X-CSRF-TOKEN header
        // on mutations. Handing the client the cookie-token value instead
        // (e.g. by making the framework's own cookie JS-readable and reusing
        // its value) fails validation with "the cookie token and the request
        // token were swapped" — the two are cryptographically related but
        // deliberately not the same string. So a distinct, JS-readable
        // "XSRF-TOKEN" cookie is appended here explicitly, holding
        // RequestToken, matching what AutoValidateAntiforgeryTokenAttribute
        // actually expects to find in the header.
        var tokens = _antiforgery.GetAndStoreTokens(HttpContext);
        Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            Secure = true,
            SameSite = SameSiteMode.Strict
        });

        return Ok(new UserDto { Id = id, Email = email });
    }
}
