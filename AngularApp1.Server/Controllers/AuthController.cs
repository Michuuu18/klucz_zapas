using AngularApp1.Server.Models;
using AngularApp1.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace AngularApp1.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserStore _users;

    public AuthController(UserStore users)
    {
        _users = users;
    }

    [HttpPost("login")]
    public ActionResult<LoginResponse> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Podaj login i hasło." });
        }

        var user = _users.Validate(request.Username, request.Password);
        if (user is null)
        {
            return Unauthorized(new { message = "Nieprawidłowy login lub hasło." });
        }

        return Ok(new LoginResponse
        {
            Username = user.Username,
            DisplayName = user.DisplayName,
            Role = user.Role.ToString(),
        });
    }
}
