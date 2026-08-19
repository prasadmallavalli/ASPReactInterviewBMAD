using Application.DTOs;

namespace Application.Services;

/// <summary>
/// The only User abstraction a controller may depend on (AD-1) — no
/// IUserRepository/DbContext/IPasswordHasher reference ever reaches Api.
/// </summary>
public interface IUserService
{
    /// <summary>
    /// Result carries EmailAlreadyExists instead of throwing/returning null
    /// alone, because Register has two distinct failure-free paths the
    /// controller must turn into two distinct status codes: 201 on success,
    /// 409 when the (normalized) email is already registered.
    /// </summary>
    Task<(UserRegistrationResult Result, UserDto? User)> RegisterAsync(UserRegistrationRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Unknown email and wrong password both collapse to
    /// UserLoginResult.InvalidCredentials — no signal distinguishes them, so
    /// the controller can never leak whether a given email is registered.
    /// Token is non-null iff Result is Success.
    /// </summary>
    Task<(UserLoginResult Result, string? Token, UserDto? User)> LoginAsync(UserLoginRequestDto request, CancellationToken cancellationToken = default);
}

/// <summary>
/// Register has two distinct outcomes the controller must turn into two
/// distinct status codes (201/409) — a bool can't carry that, so this enum
/// stands in for a richer result type, mirroring ProductWriteResult's
/// approach for Product's own multi-outcome create.
/// </summary>
public enum UserRegistrationResult
{
    Success,
    EmailAlreadyExists
}

/// <summary>
/// Login has two distinct outcomes the controller must turn into two
/// distinct status codes (200/401). Unlike UserRegistrationResult, the
/// failure case is deliberately generic — InvalidCredentials covers both
/// "unknown email" and "wrong password" with no way for the controller to
/// tell them apart, which is what prevents email-enumeration via login.
/// </summary>
public enum UserLoginResult
{
    Success,
    InvalidCredentials
}
