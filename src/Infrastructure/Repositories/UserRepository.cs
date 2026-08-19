using Domain.Entities;
using Domain.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// EF Core implementation of IUserRepository. Lives in Infrastructure so
/// Application/Api only ever see the Domain interface (AD-2) — no EF Core
/// types leak upward. No SaveChanges here: mutations are staged on the
/// tracked DbContext and persisted by UnitOfWork.SaveChangesAsync, keeping
/// "stage the change" and "commit the change" as separate steps, mirroring
/// CategoryRepository/ProductRepository.
/// </summary>
public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// AsNoTracking: existence/lookup query only, runs on every registration
    /// attempt as the duplicate-email check — no need to track the result.
    /// </summary>
    public async Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        await _context.Users.AddAsync(user, cancellationToken);
    }
}
