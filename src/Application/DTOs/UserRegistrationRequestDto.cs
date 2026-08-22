using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

/// <summary>
/// Request shape for POST /api/auth/register. Data Annotations here are
/// enforced automatically by [ApiController]'s model-state validation
/// (AD-8) — malformed payloads (missing password, malformed email,
/// out-of-range password length) 400 automatically, no hand-written checks.
/// Password length is bounded to 8-12 chars per code-review decision
/// (2026-08-22, renegotiating this story's original "no password-strength
/// policy" boundary) — no other complexity rule (e.g. character classes) is
/// enforced.
/// </summary>
public class UserRegistrationRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public required string Email { get; set; }

    [Required]
    [StringLength(12, MinimumLength = 8)]
    public required string Password { get; set; }
}
