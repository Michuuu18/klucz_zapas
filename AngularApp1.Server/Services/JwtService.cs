using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AngularApp1.Server.Models;
using Microsoft.IdentityModel.Tokens;

namespace AngularApp1.Server.Services;

/// <summary>
/// Generowanie tokena JWT — wzorowane na AccountService.GenerateJwt z RestaurantAPI.
/// </summary>
public class JwtService
{
    private readonly AuthenticationSettings _settings;

    public JwtService(AuthenticationSettings settings)
    {
        _settings = settings;
    }

    public string GenerateToken(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.GivenName, user.DisplayName),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("role", user.Role.ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.JwtKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddDays(_settings.JwtExpireDays);

        var token = new JwtSecurityToken(
            issuer: _settings.JwtIssuer,
            audience: _settings.JwtIssuer,
            claims: claims,
            expires: expires,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
