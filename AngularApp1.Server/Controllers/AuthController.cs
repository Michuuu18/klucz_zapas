using AngularApp1.Server.Models;
using AngularApp1.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AngularApp1.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserStore _users;
    private readonly JwtService _jwt;

    public AuthController(UserStore users, JwtService jwt)
    {
        _users = users;
        _jwt = jwt;
    }

    /// <summary>
    /// Logowanie — zwraca JWT (jak POST /api/account/login w RestaurantAPI).
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
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

        var token = _jwt.GenerateToken(user);

        return Ok(new LoginResponse
        {
            Token = token,
            Username = user.Username,
            DisplayName = user.DisplayName,
            Role = user.Role.ToString(),
        });
    }
}
