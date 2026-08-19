using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

/// <summary>
/// Request shape for POST /api/auth/register. Data Annotations here are
/// enforced automatically by [ApiController]'s model-state validation
/// (AD-8) — malformed payloads (missing password, malformed email) 400
/// automatically, no hand-written checks. Only presence is validated on
/// Password — no password-strength policy (length/complexity) is in this
/// story's acceptance criteria.
/// </summary>
public class UserRegistrationRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public required string Email { get; set; }

    [Required]
    public required string Password { get; set; }
}
