namespace AngularApp1.Server;

/// <summary>
/// Ustawienia JWT — wzorowane na RestaurantAPI (AuthenticationSettings).
/// </summary>
public class AuthenticationSettings
{
    public string JwtKey { get; set; } = string.Empty;
    public int JwtExpireDays { get; set; } = 7;
    public string JwtIssuer { get; set; } = string.Empty;
}
