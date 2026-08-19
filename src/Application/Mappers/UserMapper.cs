using Application.DTOs;
using Domain.Entities;

namespace Application.Mappers;

/// <summary>
/// Manual DTO&lt;-&gt;entity mapping (AD-9) — no AutoMapper. Extension method
/// keeps the mapping call-site readable (user.ToDto()) without a separate
/// injected mapper service, mirroring ProductMapper/CategoryMapper. Only
/// ToDto() exists here — entity construction (email normalization + password
/// hashing) is business logic that stays in UserService, not a mechanical
/// field copy.
/// </summary>
public static class UserMapper
{
    public static UserDto ToDto(this User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email
        };
    }
}
