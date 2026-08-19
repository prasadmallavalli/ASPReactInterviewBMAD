using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Data;

/// <summary>
/// EF Core context translating the Domain model into the real MSSQL schema.
/// Lives in Infrastructure (not Application/Api) per AD-1/AD-2 — the rest of
/// the solution depends on Domain interfaces, never on this type directly.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Product> Products => Set<Product>();

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Product>()
            .Property(p => p.Price)
            .HasColumnType("decimal(18,2)");

        // DeleteBehavior.Restrict (not Cascade): a Category with existing
        // Products must not be deletable at the DB level. Story 1.2 turns
        // the resulting DB error into a clean 409 Conflict at the service
        // layer instead of letting SQL Server cascade-delete Products.
        modelBuilder.Entity<Product>()
            .HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Story 2.1: DB-level unique index on the (already-normalized, see
        // UserService) Email so a duplicate can never physically land even if
        // the check-then-act race in UserService.RegisterAsync is hit — the
        // unique index is the last line of defense, not the primary check.
        modelBuilder.Entity<User>()
            .Property(u => u.Email)
            .HasMaxLength(256);

        modelBuilder.Entity<User>()
            .Property(u => u.PasswordHash)
            .HasMaxLength(512);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();
    }
}
