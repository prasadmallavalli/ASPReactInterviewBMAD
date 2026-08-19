namespace Domain.Entities;

/// <summary>
/// A registered user account. Kept schema-only per the Category/Product
/// pattern (Story 1.1) — no business logic here (hashing, uniqueness,
/// normalization all live in Application's UserService).
/// </summary>
public class User
{
    public int Id { get; set; }

    /// <summary>
    /// Stored normalized (Trim().ToLowerInvariant()) by UserService before
    /// persistence, so uniqueness checks and the DB-level unique index both
    /// operate on a single canonical casing.
    /// </summary>
    public required string Email { get; set; }

    /// <summary>
    /// Output of IPasswordHasher&lt;User&gt;.HashPassword — never the raw
    /// password. The raw password is never persisted, logged, or returned.
    /// </summary>
    public required string PasswordHash { get; set; }
}
