namespace Application.DTOs;

/// <summary>
/// Response shape for a Product. Domain entities never cross the controller
/// boundary (AD-3) — this is what the API actually returns.
/// </summary>
public class ProductDto
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public decimal Price { get; set; }

    public int CategoryId { get; set; }
}
