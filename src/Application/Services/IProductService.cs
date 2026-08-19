using Application.DTOs;

namespace Application.Services;

/// <summary>
/// The only Product abstraction a controller may depend on (AD-1) — no
/// IProductRepository/DbContext reference ever reaches Api.
/// </summary>
public interface IProductService
{
    Task<ProductDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<IEnumerable<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Result carries CategoryNotFound instead of throwing/returning null
    /// alone, because Create has two distinct failure-free paths the
    /// controller must turn into two distinct status codes: 201 on success,
    /// 400 when CategoryId doesn't reference an existing Category.
    /// </summary>
    Task<(ProductWriteResult Result, ProductDto? Product)> CreateAsync(ProductRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Same three-way result as Delete's enum on Category: NotFound (404),
    /// CategoryNotFound (400 — the bad-reference check), or Success (200).
    /// </summary>
    Task<(ProductWriteResult Result, ProductDto? Product)> UpdateAsync(int id, ProductRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// true when a matching Product was found and removed; false means "no
    /// Product with this id" — lets the controller map straight to 404.
    /// </summary>
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

/// <summary>
/// Create/Update have three distinct outcomes the controller must turn into
/// three distinct status codes (201/200, 400, 404) — a bool can't carry
/// that, so this enum stands in for a richer result type, mirroring
/// CategoryDeleteResult's approach for Category's own multi-outcome delete.
/// </summary>
public enum ProductWriteResult
{
    Success,
    NotFound,
    CategoryNotFound
}
