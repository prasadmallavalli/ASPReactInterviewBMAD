using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

/// <summary>
/// Request shape for both Create and Update — the fields are identical, so
/// one DTO covers both rather than duplicating an identical shape. Data
/// Annotations here are enforced automatically by [ApiController]'s
/// model-state validation (AD-8) — no FluentValidation.
/// </summary>
public class CategoryRequestDto
{
    [Required]
    [StringLength(200)]
    public required string Name { get; set; }
}
