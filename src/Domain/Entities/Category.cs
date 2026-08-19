namespace Domain.Entities;

/// <summary>
/// A product category. Kept schema-only per Story 1.1 scope — no business
/// logic (e.g. delete-guard rules) lives here; that lands in the Application
/// service layer in Story 1.2 so Domain stays a pure model.
/// </summary>
public class Category
{
    public int Id { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// Navigation collection for the Category 1—* Product relationship.
    /// Initialized empty so callers can add to it without a null check.
    /// </summary>
    public ICollection<Product> Products { get; private set; } = new List<Product>();
}
