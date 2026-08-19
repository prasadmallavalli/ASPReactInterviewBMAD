using Application.DTOs;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Depends only on IProductService (AD-1) — never IProductRepository or
/// DbContext. [ApiController] gives automatic 400 + ValidationProblemDetails
/// on Data Annotation failures (AD-8: [Required]/[StringLength]/[Range]), so
/// request shape validation never needs to be written by hand here — only
/// the CategoryId existence check (a DB lookup, not expressible as an
/// attribute) is handled explicitly below.
/// </summary>
[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;

    public ProductsController(IProductService productService)
    {
        _productService = productService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductDto>>> GetAll(CancellationToken cancellationToken)
    {
        var products = await _productService.GetAllAsync(cancellationToken);
        return Ok(products);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var product = await _productService.GetByIdAsync(id, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }

        return Ok(product);
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<ProductDto>> Create(ProductRequestDto request, CancellationToken cancellationToken)
    {
        var (result, product) = await _productService.CreateAsync(request, cancellationToken);
        if (result == ProductWriteResult.CategoryNotFound)
        {
            // Explicit existence check in the service, not a caught FK
            // error (Story 1.3's one new business rule) -> 400, not 500.
            // Problem() (not a hand-built ProblemDetails) so the registered
            // AddProblemDetails() customization is applied consistently.
            return Problem(
                title: "Invalid category",
                statusCode: StatusCodes.Status400BadRequest,
                detail: $"Category {request.CategoryId} does not exist.");
        }

        // CreatedAtAction sets the Location header per the I/O matrix,
        // pointing back at GetById for the new resource.
        return CreatedAtAction(nameof(GetById), new { id = product!.Id }, product);
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<ActionResult<ProductDto>> Update(int id, ProductRequestDto request, CancellationToken cancellationToken)
    {
        var (result, product) = await _productService.UpdateAsync(id, request, cancellationToken);
        return result switch
        {
            ProductWriteResult.NotFound => NotFound(),
            ProductWriteResult.CategoryNotFound => Problem(
                title: "Invalid category",
                statusCode: StatusCodes.Status400BadRequest,
                detail: $"Category {request.CategoryId} does not exist."),
            _ => Ok(product)
        };
    }

    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var deleted = await _productService.DeleteAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}
