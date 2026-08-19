using Application.DTOs;
using Application.Mappers;
using Domain.Entities;
using Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace Application.Services;

/// <summary>
/// Depends only on IUnitOfWork/IUserRepository (AD-2) — never EF Core or
/// AppDbContext directly, so this class is unit-testable against a mocked
/// repository without a real database, mirroring ProductService/CategoryService.
/// IPasswordHasher&lt;User&gt; is the one framework type allowed in here: it's
/// stateless/DI-provided (AD-4 Singleton), not an EF Core type, so it doesn't
/// violate AD-2. IJwtTokenGenerator (Story 2.2) is likewise a plain
/// Application-layer abstraction, not an EF Core/ASP.NET hosting type.
/// </summary>
public class UserService : IUserService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;

    public UserService(IUnitOfWork unitOfWork, IPasswordHasher<User> passwordHasher, IJwtTokenGenerator jwtTokenGenerator)
    {
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _jwtTokenGenerator = jwtTokenGenerator;
    }

    /// <summary>
    /// Email is normalized (Trim().ToLowerInvariant()) before both the
    /// uniqueness check and storage, so "Foo@x.com" and "foo@x.com" collide
    /// correctly. The existence check happens explicitly *before* any write
    /// is attempted — never by attempting the insert and catching a
    /// DbUpdateException, which would require Application to depend on EF
    /// Core (forbidden by AD-2). This is a known, accepted check-then-act
    /// race: the DB-level unique index (AppDbContext.OnModelCreating) is the
    /// last line of defense against a duplicate physically landing; worst
    /// case on the race window is a 500, not bad data. Password is hashed
    /// via IPasswordHasher&lt;User&gt; before the entity is ever constructed —
    /// the raw password is never persisted, logged, or returned.
    /// </summary>
    public async Task<(UserRegistrationResult Result, UserDto? User)> RegisterAsync(UserRegistrationRequestDto request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var existing = await _unitOfWork.Users.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (existing is not null)
        {
            return (UserRegistrationResult.EmailAlreadyExists, null);
        }

        var user = new User
        {
            Email = normalizedEmail,
            PasswordHash = string.Empty
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        await _unitOfWork.Users.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return (UserRegistrationResult.Success, user.ToDto());
    }

    /// <summary>
    /// Unknown email and wrong password both collapse to the same
    /// InvalidCredentials outcome — the lookup-miss branch returns before
    /// ever touching the hasher, and the hasher-failure branch returns the
    /// identical result, so no timing/logic signal distinguishes "email not
    /// registered" from "email registered, wrong password" (Never boundary).
    /// A token is minted only on the Success path.
    /// </summary>
    public async Task<(UserLoginResult Result, string? Token, UserDto? User)> LoginAsync(UserLoginRequestDto request, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await _unitOfWork.Users.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (user is null)
        {
            return (UserLoginResult.InvalidCredentials, null, null);
        }

        var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return (UserLoginResult.InvalidCredentials, null, null);
        }

        var token = _jwtTokenGenerator.GenerateToken(user);
        return (UserLoginResult.Success, token, user.ToDto());
    }
}
