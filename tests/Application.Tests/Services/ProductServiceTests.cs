using Application.DTOs;
using Application.Services;
using Domain.Entities;
using Domain.Interfaces;
using Moq;

namespace Application.Tests.Services;

/// <summary>
/// Story 1.6: unit tests for ProductService's four CRUD methods.
/// IUnitOfWork (and its Products/Categories repository properties) is
/// mocked via Moq — no real AppDbContext or database is ever touched, per
/// this story's "Always" boundary.
/// </summary>
public class ProductServiceTests
{
    /// <summary>
    /// Builds a ProductService wired to fresh Mock&lt;IUnitOfWork&gt;,
    /// Mock&lt;IProductRepository&gt;, and Mock&lt;ICategoryRepository&gt;
    /// instances so each test can configure only the setups it needs.
    /// </summary>
    private static (ProductService Service, Mock<IUnitOfWork> UnitOfWork, Mock<IProductRepository> Products, Mock<ICategoryRepository> Categories) CreateSut()
    {
        var products = new Mock<IProductRepository>();
        var categories = new Mock<ICategoryRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(u => u.Products).Returns(products.Object);
        unitOfWork.Setup(u => u.Categories).Returns(categories.Object);

        var service = new ProductService(unitOfWork.Object);
        return (service, unitOfWork, products, categories);
    }

    [Fact]
    public async Task CreateAsync_ValidCategoryId_ReturnsSuccessAndPersists()
    {
        var (service, unitOfWork, products, categories) = CreateSut();
        var category = new Category { Id = 1, Name = "Widgets" };
        categories.Setup(c => c.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        var request = new ProductRequestDto { Name = "Widget", Price = 9.99m, CategoryId = 1 };

        var (result, product) = await service.CreateAsync(request);

        Assert.Equal(ProductWriteResult.Success, result);
        Assert.NotNull(product);
        Assert.Equal("Widget", product!.Name);
        Assert.Equal(9.99m, product.Price);
        Assert.Equal(1, product.CategoryId);
        products.Verify(p => p.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAsync_MissingCategoryId_ReturnsCategoryNotFoundAndDoesNotPersist()
    {
        var (service, unitOfWork, products, categories) = CreateSut();
        categories.Setup(c => c.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        var request = new ProductRequestDto { Name = "Widget", Price = 9.99m, CategoryId = 99 };

        var (result, product) = await service.CreateAsync(request);

        Assert.Equal(ProductWriteResult.CategoryNotFound, result);
        Assert.Null(product);
        products.Verify(p => p.AddAsync(It.IsAny<Product>(), It.IsAny<CancellationToken>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetByIdAsync_ExistingId_ReturnsDto()
    {
        var (service, _, products, _) = CreateSut();
        var category = new Category { Id = 1, Name = "Widgets" };
        var entity = new Product { Id = 5, Name = "Widget", Price = 9.99m, CategoryId = 1, Category = category };
        products.Setup(p => p.GetByIdAsync(5, It.IsAny<CancellationToken>()))
            .ReturnsAsync(entity);

        var dto = await service.GetByIdAsync(5);

        Assert.NotNull(dto);
        Assert.Equal(5, dto!.Id);
        Assert.Equal("Widget", dto.Name);
        Assert.Equal(9.99m, dto.Price);
        Assert.Equal(1, dto.CategoryId);
    }

    [Fact]
    public async Task GetByIdAsync_MissingId_ReturnsNull()
    {
        var (service, _, products, _) = CreateSut();
        products.Setup(p => p.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var dto = await service.GetByIdAsync(404);

        Assert.Null(dto);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllMappedDtos()
    {
        var (service, _, products, _) = CreateSut();
        var category = new Category { Id = 1, Name = "Widgets" };
        var entities = new List<Product>
        {
            new() { Id = 1, Name = "Widget A", Price = 1.00m, CategoryId = 1, Category = category },
            new() { Id = 2, Name = "Widget B", Price = 2.00m, CategoryId = 1, Category = category }
        };
        products.Setup(p => p.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(entities);

        var dtos = (await service.GetAllAsync()).ToList();

        Assert.Equal(2, dtos.Count);
        Assert.Contains(dtos, d => d.Id == 1 && d.Name == "Widget A" && d.Price == 1.00m && d.CategoryId == 1);
        Assert.Contains(dtos, d => d.Id == 2 && d.Name == "Widget B" && d.Price == 2.00m && d.CategoryId == 1);
    }

    [Fact]
    public async Task GetAllAsync_EmptyRepository_ReturnsEmptyResult()
    {
        var (service, _, products, _) = CreateSut();
        products.Setup(p => p.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Product>());

        var dtos = await service.GetAllAsync();

        Assert.Empty(dtos);
    }

    [Fact]
    public async Task UpdateAsync_MissingProductId_ReturnsNotFoundAndSkipsCategoryLookupAndSave()
    {
        var (service, unitOfWork, products, categories) = CreateSut();
        products.Setup(p => p.GetByIdAsync(42, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var request = new ProductRequestDto { Name = "Widget", Price = 9.99m, CategoryId = 1 };

        var (result, product) = await service.UpdateAsync(42, request);

        Assert.Equal(ProductWriteResult.NotFound, result);
        Assert.Null(product);
        categories.Verify(c => c.GetByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ProductExistsButCategoryIdMissing_ReturnsCategoryNotFoundAndDoesNotSave()
    {
        var (service, unitOfWork, products, categories) = CreateSut();
        var originalCategory = new Category { Id = 1, Name = "Widgets" };
        var existing = new Product { Id = 7, Name = "Old Name", Price = 1.00m, CategoryId = 1, Category = originalCategory };

        products.Setup(p => p.GetByIdAsync(7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        categories.Setup(c => c.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        var request = new ProductRequestDto { Name = "New Name", Price = 5.00m, CategoryId = 99 };

        var (result, product) = await service.UpdateAsync(7, request);

        Assert.Equal(ProductWriteResult.CategoryNotFound, result);
        Assert.Null(product);
        products.Verify(p => p.Update(It.IsAny<Product>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ValidIds_ReturnsSuccessWithAppliedChanges()
    {
        var (service, unitOfWork, products, categories) = CreateSut();
        var originalCategory = new Category { Id = 1, Name = "Widgets" };
        var newCategory = new Category { Id = 2, Name = "Gadgets" };
        var existing = new Product { Id = 7, Name = "Old Name", Price = 1.00m, CategoryId = 1, Category = originalCategory };

        products.Setup(p => p.GetByIdAsync(7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        categories.Setup(c => c.GetByIdAsync(2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(newCategory);

        var request = new ProductRequestDto { Name = "New Name", Price = 5.00m, CategoryId = 2 };

        var (result, product) = await service.UpdateAsync(7, request);

        Assert.Equal(ProductWriteResult.Success, result);
        Assert.NotNull(product);
        Assert.Equal(7, product!.Id);
        Assert.Equal("New Name", product.Name);
        Assert.Equal(5.00m, product.Price);
        Assert.Equal(2, product.CategoryId);
        products.Verify(p => p.Update(existing), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_ExistingId_ReturnsTrueAndRemoves()
    {
        var (service, unitOfWork, products, _) = CreateSut();
        var category = new Category { Id = 1, Name = "Widgets" };
        var existing = new Product { Id = 3, Name = "Widget", Price = 1.00m, CategoryId = 1, Category = category };
        products.Setup(p => p.GetByIdAsync(3, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await service.DeleteAsync(3);

        Assert.True(result);
        products.Verify(p => p.Remove(existing), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_MissingId_ReturnsFalseAndDoesNotRemove()
    {
        var (service, unitOfWork, products, _) = CreateSut();
        products.Setup(p => p.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Product?)null);

        var result = await service.DeleteAsync(404);

        Assert.False(result);
        products.Verify(p => p.Remove(It.IsAny<Product>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
