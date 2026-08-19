namespace Application.DTOs;

/// <summary>
/// Response shape for a User. Domain entities never cross the controller
/// boundary (AD-3) — this is what the API actually returns. PasswordHash is
/// deliberately absent: the password/hash never appears in any response DTO.
/// </summary>
public class UserDto
{
    public int Id { get; set; }

    public required string Email { get; set; }
}
