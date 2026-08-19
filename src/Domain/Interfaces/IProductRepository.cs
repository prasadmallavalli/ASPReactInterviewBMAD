using Domain.Entities;

namespace Domain.Interfaces;

/// <summary>
/// Contract only — Story 1.1 defines the shape so Stories 1.2/1.3 can code
/// against a stable interface. Implementation lands in Infrastructure later
/// (AD-2: Application/Api depend on this interface, never on EF Core directly).
/// </summary>
public interface IProductRepository
{
    Task<Product?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<IEnumerable<Product>> GetAllAsync(CancellationToken cancellationToken = default);

    Task AddAsync(Product product, CancellationToken cancellationToken = default);

    void Update(Product product);

    void Remove(Product product);
}
