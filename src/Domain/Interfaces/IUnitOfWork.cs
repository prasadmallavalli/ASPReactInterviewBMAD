namespace Domain.Interfaces;

/// <summary>
/// Coordinates repository changes into a single atomic save. Contract only —
/// implementation (wrapping AppDbContext.SaveChangesAsync) lands in
/// Infrastructure in Stories 1.2/1.3.
/// </summary>
public interface IUnitOfWork
{
    ICategoryRepository Categories { get; }

    IProductRepository Products { get; }

    IUserRepository Users { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
