using Application.DTOs;
using Application.Services;
using Domain.Entities;
using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Moq;

namespace Application.Tests.Services;

/// <summary>
/// Story 2.1: unit tests for UserService.RegisterAsync, covering the I/O
/// matrix's happy path, case-varied duplicate email, and confirming password
/// hashing happens (never plaintext persisted). IUnitOfWork/IUserRepository
/// are mocked via Moq — no real AppDbContext or database is ever touched,
/// mirroring ProductServiceTests' "Always" boundary. Empty-password/malformed
/// email coverage is intentionally NOT unit-tested here: those are enforced
/// automatically by [ApiController]'s Data Annotation model-state validation
/// (AD-8) on UserRegistrationRequestDto, before the request ever reaches
/// UserService — there is no service-layer branch to exercise.
/// </summary>
public class UserServiceTests
{
    /// <summary>
    /// Builds a UserService wired to fresh Mock&lt;IUnitOfWork&gt;,
    /// Mock&lt;IUserRepository&gt;, a real PasswordHasher&lt;User&gt;
    /// (framework-provided, stateless, cheap to construct directly — no
    /// need to mock it), and a Mock&lt;IJwtTokenGenerator&gt; (Story 2.2) so
    /// each test can configure only the repository setups it needs and
    /// assert LoginAsync only mints a token on the success path.
    /// </summary>
    private static (UserService Service, Mock<IUnitOfWork> UnitOfWork, Mock<IUserRepository> Users, IPasswordHasher<User> Hasher, Mock<IJwtTokenGenerator> JwtTokenGenerator) CreateSut()
    {
        var users = new Mock<IUserRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(u => u.Users).Returns(users.Object);
        var hasher = new PasswordHasher<User>();
        var jwtTokenGenerator = new Mock<IJwtTokenGenerator>();

        var service = new UserService(unitOfWork.Object, hasher, jwtTokenGenerator.Object);
        return (service, unitOfWork, users, hasher, jwtTokenGenerator);
    }

    [Fact]
    public async Task RegisterAsync_UnusedEmail_ReturnsSuccessAndPersistsHashedPassword()
    {
        var (service, unitOfWork, users, hasher, _) = CreateSut();
        users.Setup(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        User? added = null;
        users.Setup(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .Callback<User, CancellationToken>((u, _) => added = u)
            .Returns(Task.CompletedTask);

        var request = new UserRegistrationRequestDto { Email = "Foo@X.com", Password = "correct-horse-battery-staple" };

        var (result, dto) = await service.RegisterAsync(request);

        Assert.Equal(UserRegistrationResult.Success, result);
        Assert.NotNull(dto);
        Assert.Equal("foo@x.com", dto!.Email);
        users.Verify(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        Assert.NotNull(added);
        Assert.Equal("foo@x.com", added!.Email);
        Assert.NotEqual("correct-horse-battery-staple", added.PasswordHash);
        Assert.NotEmpty(added.PasswordHash);
        // Confirms the stored value really is a PasswordHasher<User> hash of
        // the raw password, not just "some other string" - i.e. it verifies
        // correctly and hashing actually happened as required by the "Always"
        // boundary (never plaintext).
        Assert.Equal(
            PasswordVerificationResult.Success,
            hasher.VerifyHashedPassword(added, added.PasswordHash, "correct-horse-battery-staple"));
    }

    [Fact]
    public async Task RegisterAsync_CaseVariedDuplicateEmail_ReturnsEmailAlreadyExistsAndDoesNotPersist()
    {
        var (service, unitOfWork, users, _, _) = CreateSut();
        var existing = new User { Id = 1, Email = "foo@x.com", PasswordHash = "already-hashed" };
        users.Setup(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        // Case-varied submission of an already-registered email.
        var request = new UserRegistrationRequestDto { Email = "  FOO@X.COM  ", Password = "another-password" };

        var (result, dto) = await service.RegisterAsync(request);

        Assert.Equal(UserRegistrationResult.EmailAlreadyExists, result);
        Assert.Null(dto);
        users.Verify(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RegisterAsync_NormalizesEmailBeforeUniquenessCheck()
    {
        var (service, _, users, _, _) = CreateSut();
        users.Setup(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        users.Setup(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var request = new UserRegistrationRequestDto { Email = "  Foo@X.com  ", Password = "some-password" };

        await service.RegisterAsync(request);

        // GetByEmailAsync must have been called with the normalized form,
        // not the raw request value, so the check-then-act race window still
        // compares apples to apples with the unique index's stored value.
        users.Verify(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()), Times.Once);
    }

    /// <summary>
    /// Story 2.2: unit tests for UserService.LoginAsync, covering the I/O
    /// matrix's happy path, wrong password, and unknown email. Malformed
    /// payload coverage is intentionally NOT unit-tested here for the same
    /// reason as Register: [ApiController]'s Data Annotation validation on
    /// UserLoginRequestDto handles it before the request ever reaches
    /// UserService.
    /// </summary>
    [Fact]
    public async Task LoginAsync_CorrectCredentials_ReturnsSuccessWithTokenAndUser()
    {
        var (service, _, users, hasher, jwtTokenGenerator) = CreateSut();
        var user = new User { Id = 1, Email = "foo@x.com", PasswordHash = string.Empty };
        user.PasswordHash = hasher.HashPassword(user, "correct-horse-battery-staple");
        users.Setup(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        jwtTokenGenerator.Setup(g => g.GenerateToken(user)).Returns("signed-jwt");

        var request = new UserLoginRequestDto { Email = "Foo@X.com", Password = "correct-horse-battery-staple" };

        var (result, token, dto) = await service.LoginAsync(request);

        Assert.Equal(UserLoginResult.Success, result);
        Assert.Equal("signed-jwt", token);
        Assert.NotNull(dto);
        Assert.Equal("foo@x.com", dto!.Email);
        jwtTokenGenerator.Verify(g => g.GenerateToken(user), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_WrongPassword_ReturnsInvalidCredentialsWithNoTokenAndDoesNotMintToken()
    {
        var (service, _, users, hasher, jwtTokenGenerator) = CreateSut();
        var user = new User { Id = 1, Email = "foo@x.com", PasswordHash = string.Empty };
        user.PasswordHash = hasher.HashPassword(user, "correct-horse-battery-staple");
        users.Setup(u => u.GetByEmailAsync("foo@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var request = new UserLoginRequestDto { Email = "foo@x.com", Password = "wrong-password" };

        var (result, token, dto) = await service.LoginAsync(request);

        Assert.Equal(UserLoginResult.InvalidCredentials, result);
        Assert.Null(token);
        Assert.Null(dto);
        jwtTokenGenerator.Verify(g => g.GenerateToken(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task LoginAsync_UnknownEmail_ReturnsInvalidCredentialsIdenticalToWrongPassword()
    {
        var (service, _, users, _, jwtTokenGenerator) = CreateSut();
        users.Setup(u => u.GetByEmailAsync("nobody@x.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        var request = new UserLoginRequestDto { Email = "nobody@x.com", Password = "whatever" };

        var (result, token, dto) = await service.LoginAsync(request);

        // Same UserLoginResult.InvalidCredentials as the wrong-password case
        // above — no enumeration signal distinguishes "unknown email" from
        // "registered, wrong password" (Never boundary).
        Assert.Equal(UserLoginResult.InvalidCredentials, result);
        Assert.Null(token);
        Assert.Null(dto);
        jwtTokenGenerator.Verify(g => g.GenerateToken(It.IsAny<User>()), Times.Never);
    }
}
