using Application.DTOs;
using Application.Mappers;
using Domain.Interfaces;

namespace Application.Services;

/// <summary>
/// Depends only on IUnitOfWork/ICategoryRepository (AD-2) — never EF Core or
/// AppDbContext directly, so this class is unit-testable against a mocked
/// repository without a real database.
/// </summary>
public class CategoryService : ICategoryService
{
    private readonly IUnitOfWork _unitOfWork;

    public CategoryService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<CategoryDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var category = await _unitOfWork.Categories.GetByIdAsync(id, cancellationToken);
        return category?.ToDto();
    }

    public async Task<IEnumerable<CategoryDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var categories = await _unitOfWork.Categories.GetAllAsync(cancellationToken);
        return categories.Select(c => c.ToDto());
    }

    public async Task<CategoryDto> CreateAsync(CategoryRequestDto request, CancellationToken cancellationToken = default)
    {
        var category = request.ToEntity();
        await _unitOfWork.Categories.AddAsync(category, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return category.ToDto();
    }

    public async Task<CategoryDto?> UpdateAsync(int id, CategoryRequestDto request, CancellationToken cancellationToken = default)
    {
        var category = await _unitOfWork.Categories.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return null;
        }

        request.ApplyTo(category);
        _unitOfWork.Categories.Update(category);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return category.ToDto();
    }

    /// <summary>
    /// AD-10: the 409 is decided by an explicit HasProductsAsync check
    /// *before* any delete is attempted — never by attempting the delete and
    /// catching the DB's FK-restrict error.
    /// </summary>
    public async Task<CategoryDeleteResult> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var category = await _unitOfWork.Categories.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return CategoryDeleteResult.NotFound;
        }

        if (await _unitOfWork.Categories.HasProductsAsync(id, cancellationToken))
        {
            return CategoryDeleteResult.HasProducts;
        }

        _unitOfWork.Categories.Remove(category);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return CategoryDeleteResult.Deleted;
    }
}
