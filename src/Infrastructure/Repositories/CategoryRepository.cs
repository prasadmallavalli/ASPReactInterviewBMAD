using Domain.Entities;
using Domain.Interfaces;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

/// <summary>
/// EF Core implementation of ICategoryRepository. Lives in Infrastructure so
/// Application/Api only ever see the Domain interface (AD-2) — no EF Core
/// types leak upward. No SaveChanges here: mutations are staged on the
/// tracked DbContext and persisted by UnitOfWork.SaveChangesAsync, keeping
/// "stage the change" and "commit the change" as separate steps.
/// </summary>
public class CategoryRepository : ICategoryRepository
{
    private readonly AppDbContext _context;

    public CategoryRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<Category?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.Categories.FindAsync([id], cancellationToken);
    }

    public async Task<IEnumerable<Category>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Categories.AsNoTracking().ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Category category, CancellationToken cancellationToken = default)
    {
        await _context.Categories.AddAsync(category, cancellationToken);
    }

    public void Update(Category category)
    {
        _context.Categories.Update(category);
    }

    public void Remove(Category category)
    {
        _context.Categories.Remove(category);
    }

    /// <summary>
    /// AsNoTracking + AnyAsync: existence-only query, no entities materialized,
    /// no change tracking overhead — this runs on every delete attempt.
    /// </summary>
    public async Task<bool> HasProductsAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        return await _context.Products
            .AsNoTracking()
            .AnyAsync(p => p.CategoryId == categoryId, cancellationToken);
    }
}
