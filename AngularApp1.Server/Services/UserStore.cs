using System.Security.Cryptography;
using System.Text;
using AngularApp1.Server.Models;

namespace AngularApp1.Server.Services;

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
          new()
          {
              Id = 3,
              Username = "dominik",
              PasswordHash = Hash("dominik123"),
              DisplayName = "Dominik",
              Role = UserRole.Pracownik,
          },
          new()
          {
              Id = 4,
              Username = "michal",
              PasswordHash = Hash("michal123"),
              DisplayName = "Michał",
              Role = UserRole.Pracownik,
          },
          new()
          {
              Id = 5,
              Username = "agnieszka",
              PasswordHash = Hash("agnieszka123"),
              DisplayName = "Agnieszka",
              Role = UserRole.Pracownik,
          }
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

    public User? FindByUsername(string username)
    {
        return _users.FirstOrDefault(u =>
            string.Equals(u.Username, username.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static string Hash(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}
