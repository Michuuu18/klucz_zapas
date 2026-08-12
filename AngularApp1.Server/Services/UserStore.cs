using System.Security.Cryptography;
using System.Text;
using AngularApp1.Server.Models;

namespace AngularApp1.Server.Services;

/// <summary>
/// Prosty magazyn użytkowników w pamięci (na potrzeby wewnętrznego panelu).
/// Domyślne konta:
///   admin      / admin123      -> rola Admin
///   pracownik  / pracownik123  -> rola Pracownik
/// Hasła nie są przechowywane jawnie - trzymamy tylko ich hash SHA-256.
/// Aby dodać kolejnego pracownika, wystarczy dopisać wpis do listy poniżej
/// (użyj metody Hash("nowe_haslo") do wygenerowania wartości PasswordHash).
/// </summary>
public class UserStore
{
    private readonly List<User> _users;

    public UserStore()
    {
        _users =
        [
            new()
            {
                Id = 1,
                Username = "admin",
                PasswordHash = Hash("admin123"),
                DisplayName = "Administrator",
                Role = UserRole.Admin,
            },
            new()
            {
                Id = 2,
                Username = "pracownik",
                PasswordHash = Hash("pracownik123"),
                DisplayName = "Pracownik",
                Role = UserRole.Pracownik,
            },
        ];
    }

    public User? Validate(string username, string password)
    {
        var user = _users.FirstOrDefault(u =>
            string.Equals(u.Username, username.Trim(), StringComparison.OrdinalIgnoreCase));

        if (user is null)
        {
            return null;
        }

        return user.PasswordHash == Hash(password) ? user : null;
    }

    public static string Hash(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
