using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Api.Controllers;
using Application.DTOs;
using Application.Services;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Application.Tests.Controllers;

/// <summary>
/// Story 2.1 review finding: nothing previously exercised
/// AuthController.Register's status-code mapping (201 on success, 409 on
/// EmailAlreadyExists) — UserServiceTests only calls UserService.RegisterAsync
/// directly, never through the controller. These tests mock IUserService
/// (matching UserServiceTests' Moq style) and drive the controller action
/// itself, asserting on the resulting ObjectResult's StatusCode/Value so an
/// inverted or deleted `if (result == UserRegistrationResult.EmailAlreadyExists)`
/// branch would fail these tests instead of slipping through green.
/// </summary>
public class AuthControllerTests
{
    /// <summary>
    /// AuthController.Problem(...) resolves ProblemDetailsFactory from
    /// ControllerContext.HttpContext.RequestServices, which a bare
    /// `new AuthController(...)` never has. This builds the minimal DI
    /// container Program.cs's AddProblemDetails()/AddControllers() would
    /// otherwise provide, wires it into a DefaultHttpContext.RequestServices,
    /// and returns the fully-constructed controller so both the 201 and 409
    /// branches work without spinning up a real WebApplicationFactory.
    ///
    /// IAntiforgery is mocked (Story 2.3) rather than resolved from the real
    /// antiforgery system: these tests exercise AuthController's own
    /// status-code/cookie-setting logic, not IAntiforgery's internals
    /// (covered separately by the WebApplicationFactory-based integration
    /// tests). GetAndStoreTokens(...) is stubbed to return a fixed
    /// AntiforgeryTokenSet with a non-null RequestToken — Login reads
    /// tokens.RequestToken! to build the XSRF-TOKEN cookie, so a mock
    /// returning the default null AntiforgeryTokenSet would NRE there.
    /// </summary>
    private static AuthController CreateSut(Mock<IUserService> userService)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddOptions();
        services.Configure<ApiBehaviorOptions>(_ => { });
        services.AddProblemDetails();
        services.AddSingleton<ProblemDetailsFactory, DefaultProblemDetailsFactory>();
        var requestServices = services.BuildServiceProvider();

        var antiforgery = new Mock<IAntiforgery>();
        antiforgery.Setup(a => a.GetAndStoreTokens(It.IsAny<HttpContext>()))
            .Returns(new AntiforgeryTokenSet(
                requestToken: "test-request-token",
                cookieToken: "test-cookie-token",
                formFieldName: "__RequestVerificationToken",
                headerName: "X-CSRF-TOKEN"));

        return new AuthController(userService.Object, antiforgery.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { RequestServices = requestServices }
            }
        };
    }

    [Fact]
    public async Task Register_Success_Returns201WithUser()
    {
        var userService = new Mock<IUserService>();
        var expected = new UserDto { Id = 1, Email = "foo@x.com" };
        userService.Setup(s => s.RegisterAsync(It.IsAny<UserRegistrationRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserRegistrationResult.Success, expected));
        var controller = CreateSut(userService);
        var request = new UserRegistrationRequestDto { Email = "foo@x.com", Password = "correct-horse-battery-staple" };

        var actionResult = await controller.Register(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status201Created, objectResult.StatusCode);
        var dto = Assert.IsType<UserDto>(objectResult.Value);
        Assert.Equal("foo@x.com", dto.Email);
    }

    [Fact]
    public async Task Register_EmailAlreadyExists_Returns409Problem()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(s => s.RegisterAsync(It.IsAny<UserRegistrationRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserRegistrationResult.EmailAlreadyExists, (UserDto?)null));
        var controller = CreateSut(userService);
        var request = new UserRegistrationRequestDto { Email = "foo@x.com", Password = "another-password" };

        var actionResult = await controller.Register(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status409Conflict, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal(StatusCodes.Status409Conflict, problem.Status);
        Assert.Equal("Email already registered", problem.Title);
    }

    /// <summary>
    /// Story 2.2: mirrors the Register tests above, driving
    /// AuthController.Login directly with a mocked IUserService. Confirms
    /// the AD-5 cookie is set (name, HttpOnly/Secure/SameSite=Strict flags)
    /// on success and that the response body never carries the raw token —
    /// only { id, email }.
    ///
    /// Story 2.3 update: Login must set ONLY the access_token cookie now —
    /// CSRF-token issuance moved to Me() after manual HTTPS verification
    /// proved GetAndStoreTokens(HttpContext) called from Login (still
    /// unauthenticated at that point) mints a token bound to "no identity",
    /// which then fails every later mutation with "the provided antiforgery
    /// token was meant for a different claims-based user than the current
    /// user." This test's single-cookie assertion is what would catch a
    /// regression back to that broken design.
    /// </summary>
    [Fact]
    public async Task Login_Success_Returns200WithUserAndSetsOnlyAccessTokenCookie()
    {
        var userService = new Mock<IUserService>();
        var expected = new UserDto { Id = 1, Email = "foo@x.com" };
        userService.Setup(s => s.LoginAsync(It.IsAny<UserLoginRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserLoginResult.Success, "signed-jwt", expected));
        var controller = CreateSut(userService);
        var request = new UserLoginRequestDto { Email = "foo@x.com", Password = "correct-horse-battery-staple" };

        var actionResult = await controller.Login(request, CancellationToken.None);

        var objectResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status200OK, objectResult.StatusCode);
        var dto = Assert.IsType<UserDto>(objectResult.Value);
        Assert.Equal("foo@x.com", dto.Email);

        // Exactly one Set-Cookie header now: access_token only. No
        // XSRF-TOKEN — that moved to Me().
        var setCookieHeader = Assert.Single(controller.Response.Headers.SetCookie);
        Assert.Contains("access_token=signed-jwt", setCookieHeader);
        Assert.Contains("httponly", setCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", setCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", setCookieHeader, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("XSRF-TOKEN", setCookieHeader);

        // AD-5: the raw token string never appears in the response body.
        Assert.DoesNotContain("signed-jwt", dto.Email);
    }

    [Fact]
    public async Task Login_InvalidCredentials_Returns401ProblemAndSetsNoCookie()
    {
        var userService = new Mock<IUserService>();
        userService.Setup(s => s.LoginAsync(It.IsAny<UserLoginRequestDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserLoginResult.InvalidCredentials, (string?)null, (UserDto?)null));
        var controller = CreateSut(userService);
        var request = new UserLoginRequestDto { Email = "foo@x.com", Password = "wrong-password" };

        var actionResult = await controller.Login(request, CancellationToken.None);

        var objectResult = Assert.IsType<ObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status401Unauthorized, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal(StatusCodes.Status401Unauthorized, problem.Status);
        Assert.Equal("Invalid credentials", problem.Title);
        Assert.False(controller.Response.Headers.ContainsKey("Set-Cookie"));
    }

    /// <summary>
    /// Story 2.3: Me() now issues the CSRF token (moved here from Login —
    /// see Login_Success_Returns200WithUserAndSetsOnlyAccessTokenCookie's
    /// doc comment for why). HttpContext.User is set directly to a
    /// ClaimsPrincipal carrying the same claim types/names
    /// JwtTokenGenerator mints and Program.cs's MapInboundClaims = false
    /// preserves, standing in for what the real JWT bearer middleware would
    /// populate once [Authorize] has already accepted the access_token
    /// cookie — Me() itself never touches JwtBearer internals directly, so
    /// this is a faithful, minimal substitute for it.
    /// </summary>
    [Fact]
    public void Me_Authenticated_Returns200WithUserAndSetsXsrfTokenCookie()
    {
        var userService = new Mock<IUserService>();
        var controller = CreateSut(userService);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, "1"),
            new(JwtRegisteredClaimNames.Email, "foo@x.com")
        };
        controller.ControllerContext.HttpContext.User =
            new ClaimsPrincipal(new ClaimsIdentity(claims, authenticationType: "TestAuth"));

        var actionResult = controller.Me();

        var objectResult = Assert.IsType<OkObjectResult>(actionResult.Result);
        Assert.Equal(StatusCodes.Status200OK, objectResult.StatusCode);
        var dto = Assert.IsType<UserDto>(objectResult.Value);
        Assert.Equal(1, dto.Id);
        Assert.Equal("foo@x.com", dto.Email);

        var xsrfCookie = Assert.Single(controller.Response.Headers.SetCookie);
        Assert.Contains("XSRF-TOKEN=test-request-token", xsrfCookie);
        Assert.Contains("secure", xsrfCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", xsrfCookie, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("httponly", xsrfCookie, StringComparison.OrdinalIgnoreCase);
    }
}
