using Domain.Entities;

namespace Domain.Interfaces;

/// <summary>
/// Contract only — Application/Api depend on this interface, never on EF
/// Core directly (AD-2). Implementation lands in Infrastructure.
/// </summary>
public interface IUserRepository
{
    /// <summary>
    /// Looks up a user by their already-normalized email (Trim().ToLowerInvariant()
    /// applied by the caller, UserService, before this is invoked) so a
    /// case-varied duplicate (Foo@X.com vs foo@x.com) is caught correctly.
    /// </summary>
    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);
}
