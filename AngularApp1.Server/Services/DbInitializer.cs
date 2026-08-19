using System.Text.RegularExpressions;
using AngularApp1.Server.Data;
using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AngularApp1.Server.Services;

public static class DbInitializer
{
    private static readonly Regex NewKeyRegex = new(@"^K-([OZ])-(\d+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex NewQrRegex = new(@"^QR-([OZ])-(\d+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static void Initialize(AppDbContext db)
    {
        db.Database.Migrate();
        AllowSpareKeysForSamePlate(db);
        RenameLegacyKeyNames(db);

        if (db.Cars.Any())
        {
            return;
        }

        db.Cars.AddRange(
            new Car { Brand = "Toyota", Model = "Corolla", Registration = "BB 1234A", KeyNumber = "K-O-01", QrCode = "QR-O-01", Status = "FREE" },
            new Car { Brand = "Volkswagen", Model = "Passat", Registration = "BB 5678B", KeyNumber = "K-O-02", QrCode = "QR-O-02", Status = "FREE" },
            new Car { Brand = "Skoda", Model = "Octavia", Registration = "SB 9012C", KeyNumber = "K-O-03", QrCode = "QR-O-03", Status = "FREE" },
            new Car { Brand = "Ford", Model = "Transit", Registration = "BB 3456D", KeyNumber = "K-O-04", QrCode = "QR-O-04", Status = "FREE" },
            new Car { Brand = "BMW", Model = "320d", Registration = "KR 7890E", KeyNumber = "K-O-05", QrCode = "QR-O-05", Status = "FREE" },
            new Car { Brand = "BMW", Model = "335i", Registration = "SZ 9707", KeyNumber = "K-O-06", QrCode = "QR-O-06", Status = "FREE" }
        );

        db.SaveChanges();
    }

    private static void AllowSpareKeysForSamePlate(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            DROP INDEX IF EXISTS "IX_cars_Registration";
            DROP INDEX IF EXISTS ix_cars_registration;
            """);
    }

    private static void RenameLegacyKeyNames(AppDbContext db)
    {
        var cars = db.Cars.OrderBy(c => c.Id).ToList();
        if (cars.Count == 0 || cars.All(c => IsNewKey(c.KeyNumber) && IsNewQr(c.QrCode)))
        {
            return;
        }

        var planned = new List<(Car Car, string Key, string Qr)>();
        var originalSlot = 1;
        var spareSlot = 1;

        foreach (var car in cars)
        {
            var kind = ResolveKind(car.KeyNumber, car.QrCode);
            var slot = kind == "Z" ? spareSlot++ : originalSlot++;
            var padded = slot.ToString("D2");
            planned.Add((car, $"K-{kind}-{padded}", $"QR-{kind}-{padded}"));
        }

        foreach (var (car, _, _) in planned)
        {
            car.KeyNumber = $"__MIG_KEY_{car.Id}";
            car.QrCode = $"__MIG_QR_{car.Id}";
        }

        db.SaveChanges();

        foreach (var (car, key, qr) in planned)
        {
            car.KeyNumber = key;
            car.QrCode = qr;
        }

        db.SaveChanges();
    }

    private static bool IsNewKey(string value) => NewKeyRegex.IsMatch(value.Trim());

    private static bool IsNewQr(string value) => NewQrRegex.IsMatch(value.Trim());

    private static string ResolveKind(string key, string qr)
    {
        var keyMatch = NewKeyRegex.Match(key.Trim());
        if (keyMatch.Success)
        {
            return keyMatch.Groups[1].Value.ToUpperInvariant();
        }

        var qrMatch = NewQrRegex.Match(qr.Trim());
        if (qrMatch.Success)
        {
            return qrMatch.Groups[1].Value.ToUpperInvariant();
        }

        return key.Trim().StartsWith("K-Z-", StringComparison.OrdinalIgnoreCase) ? "Z" : "O";
    }
}
