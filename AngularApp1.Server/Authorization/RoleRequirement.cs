using Microsoft.AspNetCore.Authorization;

namespace AngularApp1.Server.Authorization;

/// <summary>
/// Prosta reguła autoryzacji — wzorowana na policies z RestaurantAPI/Authorization.
/// U nas: wymaga konkretnej roli (Admin lub Pracownik).
/// </summary>
public class RoleRequirement : IAuthorizationRequirement
{
    public string Role { get; }

    public RoleRequirement(string role)
    {
        Role = role;
    }
}

public class RoleRequirementHandler : AuthorizationHandler<RoleRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        RoleRequirement requirement)
    {
        if (context.User.IsInRole(requirement.Role) || context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
