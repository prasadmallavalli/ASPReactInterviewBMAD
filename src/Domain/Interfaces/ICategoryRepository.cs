using Domain.Entities;

namespace Domain.Interfaces;

/// <summary>
/// Contract only — Story 1.1 defines the shape so Stories 1.2/1.3 can code
/// against a stable interface. Implementation lands in Infrastructure later
/// (AD-2: Application/Api depend on this interface, never on EF Core directly).
/// </summary>
public interface ICategoryRepository
{
    Task<Category?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<IEnumerable<Category>> GetAllAsync(CancellationToken cancellationToken = default);

    Task AddAsync(Category category, CancellationToken cancellationToken = default);

    void Update(Category category);

    void Remove(Category category);

    /// <summary>
    /// Cheap existence check (no entity materialization) so CategoryService
    /// can enforce the delete-with-Products 409 rule (AD-10) without loading
    /// the full Product set.
    /// </summary>
    Task<bool> HasProductsAsync(int categoryId, CancellationToken cancellationToken = default);
}
