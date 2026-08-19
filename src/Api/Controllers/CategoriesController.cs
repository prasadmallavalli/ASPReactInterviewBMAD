using Application.DTOs;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

/// <summary>
/// Depends only on ICategoryService (AD-1) — never ICategoryRepository or
/// DbContext. [ApiController] gives automatic 400 + ValidationProblemDetails
/// on Data Annotation failures (AD-8), so request validation never needs to
/// be written by hand here.
/// </summary>
[ApiController]
[Route("api/categories")]
public class CategoriesController : ControllerBase
{
    private readonly ICategoryService _categoryService;

    public CategoriesController(ICategoryService categoryService)
    {
        _categoryService = categoryService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<CategoryDto>>> GetAll(CancellationToken cancellationToken)
    {
        var categories = await _categoryService.GetAllAsync(cancellationToken);
        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<CategoryDto>> GetById(int id, CancellationToken cancellationToken)
    {
        var category = await _categoryService.GetByIdAsync(id, cancellationToken);
        if (category is null)
        {
            return NotFound();
        }

        return Ok(category);
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult<CategoryDto>> Create(CategoryRequestDto request, CancellationToken cancellationToken)
    {
        var created = await _categoryService.CreateAsync(request, cancellationToken);
        // CreatedAtAction sets the Location header per the I/O matrix, pointing
        // back at GetById for the new resource.
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<ActionResult<CategoryDto>> Update(int id, CategoryRequestDto request, CancellationToken cancellationToken)
    {
        var updated = await _categoryService.UpdateAsync(id, request, cancellationToken);
        if (updated is null)
        {
            return NotFound();
        }

        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var result = await _categoryService.DeleteAsync(id, cancellationToken);
        return result switch
        {
            CategoryDeleteResult.NotFound => NotFound(),
            // 409 via explicit business-rule check in the service, never a
            // caught DB FK-restrict exception (AD-10). Problem() (not a
            // hand-built ProblemDetails) so the registered AddProblemDetails()
            // customization (traceId, instance, etc.) is applied consistently.
            CategoryDeleteResult.HasProducts => Problem(
                title: "Cannot delete category with existing products",
                statusCode: StatusCodes.Status409Conflict,
                detail: $"Category {id} has one or more products and cannot be deleted."),
            _ => NoContent()
        };
    }
}
