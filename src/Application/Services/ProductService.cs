using Application.DTOs;
using Application.Mappers;
using Domain.Interfaces;

namespace Application.Services;

/// <summary>
/// Depends only on IUnitOfWork/IProductRepository/ICategoryRepository
/// (AD-2) — never EF Core or AppDbContext directly, so this class is
/// unit-testable against a mocked repository without a real database
/// (Story 1.6 adds that suite).
/// </summary>
public class ProductService : IProductService
{
    private readonly IUnitOfWork _unitOfWork;

    public ProductService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<ProductDto?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(id, cancellationToken);
        return product?.ToDto();
    }

    public async Task<IEnumerable<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var products = await _unitOfWork.Products.GetAllAsync(cancellationToken);
        return products.Select(p => p.ToDto());
    }

    /// <summary>
    /// Story 1.3's one new business rule: CategoryId must reference an
    /// existing Category, checked explicitly via Categories.GetByIdAsync
    /// *before* any write is attempted — never by attempting the insert and
    /// catching the DB's FK-constraint error. The loaded Category is then
    /// handed to ToEntity() so the new Product's required Category
    /// navigation is populated without a second round-trip.
    /// </summary>
    public async Task<(ProductWriteResult Result, ProductDto? Product)> CreateAsync(ProductRequestDto request, CancellationToken cancellationToken = default)
    {
        var category = await _unitOfWork.Categories.GetByIdAsync(request.CategoryId, cancellationToken);
        if (category is null)
        {
            return (ProductWriteResult.CategoryNotFound, null);
        }

        var product = request.ToEntity(category);
        await _unitOfWork.Products.AddAsync(product, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return (ProductWriteResult.Success, product.ToDto());
    }

    /// <summary>
    /// Same explicit-existence-check rule as Create applies to Update: a
    /// CategoryId change must still reference a real Category, checked
    /// before ApplyTo() mutates the tracked entity.
    /// </summary>
    public async Task<(ProductWriteResult Result, ProductDto? Product)> UpdateAsync(int id, ProductRequestDto request, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(id, cancellationToken);
        if (product is null)
        {
            return (ProductWriteResult.NotFound, null);
        }

        var category = await _unitOfWork.Categories.GetByIdAsync(request.CategoryId, cancellationToken);
        if (category is null)
        {
            return (ProductWriteResult.CategoryNotFound, null);
        }

        request.ApplyTo(product);
        _unitOfWork.Products.Update(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return (ProductWriteResult.Success, product.ToDto());
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var product = await _unitOfWork.Products.GetByIdAsync(id, cancellationToken);
        if (product is null)
        {
            return false;
        }

        _unitOfWork.Products.Remove(product);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }
}
