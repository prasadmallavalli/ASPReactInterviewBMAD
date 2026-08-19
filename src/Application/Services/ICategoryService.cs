using Application.DTOs;

namespace Application.Services;

/// <summary>
/// The only Category abstraction a controller may depend on (AD-1) — no
/// ICategoryRepository/DbContext reference ever reaches Api.
/// </summary>
public interface ICategoryService
{
    Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<IEnumerable<CategoryDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<CategoryDto> CreateAsync(CategoryRequestDto request, CancellationToken cancellationToken = default);

    /// <summary>
    /// Null return means "no Category with this id" — lets the controller
    /// map straight to 404 without a separate existence check.
    /// </summary>
    Task<CategoryDto?> UpdateAsync(int id, CategoryRequestDto request, CancellationToken cancellationToken = default);

    Task<CategoryDeleteResult> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

/// <summary>
/// Delete has three distinct outcomes the controller must turn into three
/// distinct status codes (404/409/204) — a bool can't carry that, so this
/// enum stands in for a richer result type.
/// </summary>
public enum CategoryDeleteResult
{
    NotFound,
    HasProducts,
    Deleted
}
