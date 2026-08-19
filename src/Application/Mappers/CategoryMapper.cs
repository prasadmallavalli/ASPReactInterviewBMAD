using Application.DTOs;
using Domain.Entities;

namespace Application.Mappers;

/// <summary>
/// Manual DTO&lt;-&gt;entity mapping (AD-9) — no AutoMapper. Extension methods
/// keep the mapping call-site readable (category.ToDto()) without a
/// separate injected mapper service, since the mapping has no dependencies
/// of its own.
/// </summary>
public static class CategoryMapper
{
    public static CategoryDto ToDto(this Category category)
    {
        return new CategoryDto
        {
            Id = category.Id,
            Name = category.Name
        };
    }

    /// <summary>
    /// Builds a new, unsaved entity from a request DTO. Only maps
    /// caller-supplied fields (Name) — Id is DB-generated, never
    /// accepted from the request body, which is what rules out
    /// over-posting into identity/ownership fields.
    /// </summary>
    public static Category ToEntity(this CategoryRequestDto dto)
    {
        return new Category
        {
            Name = dto.Name
        };
    }

    /// <summary>
    /// Applies a request DTO onto an already-loaded, tracked entity for
    /// updates, instead of constructing a new one — preserves the entity's
    /// Id/Products navigation and keeps EF's change tracking intact.
    /// </summary>
    public static void ApplyTo(this CategoryRequestDto dto, Category category)
    {
        category.Name = dto.Name;
    }
}
