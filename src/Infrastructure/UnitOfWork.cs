using Domain.Interfaces;
using Infrastructure.Data;

namespace Infrastructure;

/// <summary>
/// Implements IUnitOfWork by taking both repositories via DI (not `new`-ing
/// them) so the Program.cs AddScoped&lt;ICategoryRepository,...&gt; /
/// AddScoped&lt;IProductRepository,...&gt; registrations are the actual source
/// of these instances. Since AppDbContext, the repositories, and this class
/// are all registered Scoped (AD-4), the container resolves everything
/// against one shared AppDbContext per request, so mutations and
/// SaveChangesAsync still commit atomically.
/// </summary>
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;

    public UnitOfWork(AppDbContext context, ICategoryRepository categories, IProductRepository products, IUserRepository users)
    {
        _context = context;
        Categories = categories;
        Products = products;
        Users = users;
    }

    public ICategoryRepository Categories { get; }

    public IProductRepository Products { get; }

    public IUserRepository Users { get; }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
