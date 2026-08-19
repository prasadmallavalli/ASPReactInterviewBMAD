using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

/// <summary>
/// Request shape for both Create and Update — the fields are identical, so
/// one DTO covers both rather than duplicating an identical shape. Data
/// Annotations here are enforced automatically by [ApiController]'s
/// model-state validation (AD-8) — no FluentValidation.
///
/// [Range(0.01, 1000000)] on Price is the validation flagged and explicitly
/// deferred during Story 1.1's review (Domain stays schema-only per AD-8) —
/// it finally lands here rather than on the entity.
///
/// CategoryId has no Data Annotation: "does this id exist" isn't expressible
/// as a stateless attribute — it requires a DB lookup, which is why
/// ProductService checks it explicitly and returns 400 (not a validation
/// attribute's automatic 400) when it doesn't.
/// </summary>
public class ProductRequestDto
{
    [Required]
    [StringLength(200)]
    public required string Name { get; set; }

    [Range(0.01, 1000000)]
    public decimal Price { get; set; }

    public int CategoryId { get; set; }
}
