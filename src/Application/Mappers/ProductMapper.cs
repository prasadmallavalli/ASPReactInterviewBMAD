using Application.DTOs;
using Domain.Entities;

namespace Application.Mappers;

/// <summary>
/// Manual DTO&lt;-&gt;entity mapping (AD-9) — no AutoMapper. Extension methods
/// keep the mapping call-site readable (product.ToDto()) without a separate
/// injected mapper service, since the mapping has no dependencies of its own.
/// </summary>
public static class ProductMapper
{
    public static ProductDto ToDto(this Product product)
    {
        return new ProductDto
        {
            Id = product.Id,
            Name = product.Name,
            Price = product.Price,
            CategoryId = product.CategoryId
        };
    }

    /// <summary>
    /// Builds a new, unsaved entity from a request DTO. Takes the
    /// already-loaded Category (fetched by ProductService's existence check
    /// before calling this) rather than re-querying — Product.Category is a
    /// required non-nullable navigation, so the caller must supply an
    /// instance once it has confirmed the id exists. Only maps
    /// caller-supplied fields — Id is DB-generated, never accepted from the
    /// request body, which is what rules out over-posting into
    /// identity/ownership fields.
    /// </summary>
    public static Product ToEntity(this ProductRequestDto dto, Category category)
    {
        return new Product
        {
            Name = dto.Name,
            Price = dto.Price,
            CategoryId = dto.CategoryId,
            Category = category
        };
    }

    /// <summary>
    /// Applies a request DTO onto an already-loaded, tracked entity for
    /// updates, instead of constructing a new one — preserves the entity's
    /// Id and keeps EF's change tracking intact. Only touches the CategoryId
    /// scalar FK, not the Category navigation property — EF tracks the FK
    /// change from the scalar alone, and the navigation is never read back
    /// out through ToDto(), so leaving it unset here is safe.
    /// </summary>
    public static void ApplyTo(this ProductRequestDto dto, Product product)
    {
        product.Name = dto.Name;
        product.Price = dto.Price;
        product.CategoryId = dto.CategoryId;
    }
}
