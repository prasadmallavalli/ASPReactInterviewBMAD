using Application.DTOs;
using Application.Services;
using Domain.Entities;
using Domain.Interfaces;
using Moq;

namespace Application.Tests.Services;

/// <summary>
/// Retro fix (Epic 1, Finding A): CategoryService had zero test coverage at
/// any level -- unlike ProductService (Story 1.6), nothing exercised its
/// four CRUD methods, including the DeleteAsync 409 delete-guard rule that
/// is this service's whole reason to exist (AD-10). Mirrors
/// ProductServiceTests.cs's pattern exactly: IUnitOfWork (and its
/// Categories/Products repository properties) is mocked via Moq -- no real
/// AppDbContext or database is ever touched.
/// </summary>
public class CategoryServiceTests
{
    private static (CategoryService Service, Mock<IUnitOfWork> UnitOfWork, Mock<ICategoryRepository> Categories, Mock<IProductRepository> Products) CreateSut()
    {
        var categories = new Mock<ICategoryRepository>();
        var products = new Mock<IProductRepository>();
        var unitOfWork = new Mock<IUnitOfWork>();
        unitOfWork.Setup(u => u.Categories).Returns(categories.Object);
        unitOfWork.Setup(u => u.Products).Returns(products.Object);

        var service = new CategoryService(unitOfWork.Object);
        return (service, unitOfWork, categories, products);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_ReturnsDtoAndPersists()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        var request = new CategoryRequestDto { Name = "Widgets" };

        var dto = await service.CreateAsync(request);

        Assert.Equal("Widgets", dto.Name);
        categories.Verify(c => c.AddAsync(It.IsAny<Category>(), It.IsAny<CancellationToken>()), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_ExistingId_ReturnsDto()
    {
        var (service, _, categories, _) = CreateSut();
        var entity = new Category { Id = 1, Name = "Widgets" };
        categories.Setup(c => c.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(entity);

        var dto = await service.GetByIdAsync(1);

        Assert.NotNull(dto);
        Assert.Equal(1, dto!.Id);
        Assert.Equal("Widgets", dto.Name);
    }

    [Fact]
    public async Task GetByIdAsync_MissingId_ReturnsNull()
    {
        var (service, _, categories, _) = CreateSut();
        categories.Setup(c => c.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        var dto = await service.GetByIdAsync(404);

        Assert.Null(dto);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsAllMappedDtos()
    {
        var (service, _, categories, _) = CreateSut();
        var entities = new List<Category>
        {
            new() { Id = 1, Name = "Widgets" },
            new() { Id = 2, Name = "Gadgets" }
        };
        categories.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(entities);

        var dtos = (await service.GetAllAsync()).ToList();

        Assert.Equal(2, dtos.Count);
        Assert.Contains(dtos, d => d.Id == 1 && d.Name == "Widgets");
        Assert.Contains(dtos, d => d.Id == 2 && d.Name == "Gadgets");
    }

    [Fact]
    public async Task GetAllAsync_EmptyRepository_ReturnsEmptyResult()
    {
        var (service, _, categories, _) = CreateSut();
        categories.Setup(c => c.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Category>());

        var dtos = await service.GetAllAsync();

        Assert.Empty(dtos);
    }

    [Fact]
    public async Task UpdateAsync_MissingId_ReturnsNullAndDoesNotSave()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        categories.Setup(c => c.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        var request = new CategoryRequestDto { Name = "Widgets" };

        var dto = await service.UpdateAsync(404, request);

        Assert.Null(dto);
        categories.Verify(c => c.Update(It.IsAny<Category>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateAsync_ExistingId_ReturnsDtoWithAppliedChanges()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        var existing = new Category { Id = 1, Name = "Old Name" };
        categories.Setup(c => c.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var request = new CategoryRequestDto { Name = "New Name" };

        var dto = await service.UpdateAsync(1, request);

        Assert.NotNull(dto);
        Assert.Equal(1, dto!.Id);
        Assert.Equal("New Name", dto.Name);
        categories.Verify(c => c.Update(existing), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteAsync_MissingId_ReturnsNotFoundAndDoesNotRemove()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        categories.Setup(c => c.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        var result = await service.DeleteAsync(404);

        Assert.Equal(CategoryDeleteResult.NotFound, result);
        categories.Verify(c => c.HasProductsAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        categories.Verify(c => c.Remove(It.IsAny<Category>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// The core AD-10 business rule this service exists to implement: a
    /// Category with existing Products can't be deleted. This is the branch
    /// the retro found had zero coverage anywhere -- inverting it would
    /// previously have shipped a passing dotnet test run.
    /// </summary>
    [Fact]
    public async Task DeleteAsync_HasProducts_ReturnsHasProductsAndDoesNotRemove()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        var existing = new Category { Id = 1, Name = "Widgets" };
        categories.Setup(c => c.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        categories.Setup(c => c.HasProductsAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await service.DeleteAsync(1);

        Assert.Equal(CategoryDeleteResult.HasProducts, result);
        categories.Verify(c => c.Remove(It.IsAny<Category>()), Times.Never);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteAsync_NoProducts_ReturnsDeletedAndRemoves()
    {
        var (service, unitOfWork, categories, _) = CreateSut();
        var existing = new Category { Id = 1, Name = "Widgets" };
        categories.Setup(c => c.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);
        categories.Setup(c => c.HasProductsAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await service.DeleteAsync(1);

        Assert.Equal(CategoryDeleteResult.Deleted, result);
        categories.Verify(c => c.Remove(existing), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
