namespace Application.DTOs;

/// <summary>
/// Response shape for a Category. Domain entities never cross the controller
/// boundary (AD-3) — this is what the API actually returns.
/// </summary>
public class CategoryDto
{
    public int Id { get; set; }

    public required string Name { get; set; }
}
