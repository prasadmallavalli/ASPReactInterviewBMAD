using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

/// <summary>
/// Request shape for POST /api/auth/login. Data Annotations here are
/// enforced automatically by [ApiController]'s model-state validation
/// (AD-8) — missing password / malformed email 400 automatically, mirroring
/// UserRegistrationRequestDto.
/// </summary>
public class UserLoginRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public required string Email { get; set; }

    [Required]
    [StringLength(256)]
    public required string Password { get; set; }
}
