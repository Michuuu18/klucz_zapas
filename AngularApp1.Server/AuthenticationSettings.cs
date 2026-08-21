namespace AngularApp1.Server;


// Ustawienia JWT z sekcji Authentication w appsettings.json.
public class AuthenticationSettings
{
    public string JwtKey { get; set; } = string.Empty;
    public int JwtExpireDays { get; set; } = 7;
    public string JwtIssuer { get; set; } = string.Empty;
}
