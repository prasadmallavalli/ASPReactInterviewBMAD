namespace Domain.Entities;

/// <summary>
/// A product belonging to exactly one Category. Kept schema-only per Story
/// 1.1 scope — no business logic here (validation/mapping live in Application).
/// </summary>
public class Product
{
    public int Id { get; set; }

    public required string Name { get; set; }

    /// <summary>
    /// decimal (not double/float) to avoid floating-point rounding error on
    /// currency values — standard practice for money-shaped columns.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// FK to Category. No cascade delete (see AppDbContext Fluent API config):
    /// deleting a Category with existing Products is a 409 Conflict enforced
    /// at the Application service layer in Story 1.2, not a DB-level cascade.
    /// </summary>
    public int CategoryId { get; set; }

    public required Category Category { get; set; }
}
