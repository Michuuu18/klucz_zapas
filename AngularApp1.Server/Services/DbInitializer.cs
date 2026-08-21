using System.Text.RegularExpressions;
using AngularApp1.Server.Data;
using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AngularApp1.Server.Services;

// Start aplikacji: migracje, poprawki schematu, seed danych.
public static class DbInitializer
{
    private static readonly Regex NewKeyRegex = new(@"^K-([OZ])-(\d+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex LegacyQrRegex = new(@"^QR-([OZ])-(\d+)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PlateQrRegex = new(@"^\d{2,3}[A-Za-z0-9]{2}$", RegexOptions.Compiled);

    public static void Initialize(AppDbContext db)
    {
        db.Database.Migrate();
        AllowSpareKeysForSamePlate(db);
        EnsureNoteColumn(db);
        EnsureLogNoteColumn(db);
        RenameLegacyKeyNames(db);
        MigrateLegacyQrCodes(db);
        SyncQrRegistrationSuffix(db);

        if (db.Cars.Any())
        {
            return;
        }

        db.Cars.AddRange(
            new Car { Brand = "Toyota", Model = "Corolla", Registration = "SB 10231", KeyNumber = "K-O-01", QrCode = "0131", Status = "FREE" },
            new Car { Brand = "Toyota", Model = "Corolla", Registration = "SB 10232", KeyNumber = "K-O-02", QrCode = "0232", Status = "FREE" },
            new Car { Brand = "Toyota", Model = "Corolla", Registration = "SB 10233", KeyNumber = "K-O-03", QrCode = "0333", Status = "FREE" },
            new Car { Brand = "Toyota", Model = "Yaris", Registration = "SB 20441", KeyNumber = "K-O-04", QrCode = "0441", Status = "FREE" },
            new Car { Brand = "Toyota", Model = "Yaris", Registration = "SB 20442", KeyNumber = "K-O-05", QrCode = "0542", Status = "FREE" },
            new Car { Brand = "BMW", Model = "320d", Registration = "SB 31001", KeyNumber = "K-O-06", QrCode = "0601", Status = "FREE" },
            new Car { Brand = "BMW", Model = "320d", Registration = "SB 31002", KeyNumber = "K-O-07", QrCode = "0702", Status = "FREE" },
            new Car { Brand = "Ford", Model = "Focus", Registration = "SB 45110", KeyNumber = "K-O-08", QrCode = "0810", Status = "FREE" },
            new Car { Brand = "Ford", Model = "Focus", Registration = "SB 45111", KeyNumber = "K-O-09", QrCode = "0911", Status = "FREE" },
            new Car { Brand = "Ford", Model = "Focus", Registration = "SB 45112", KeyNumber = "K-O-10", QrCode = "1012", Status = "FREE" }
        );

        db.SaveChanges();
    }

    // Ta sama rejestracja może mieć klucz O i Z — usuwa unikalny indeks na Registration.
    private static void AllowSpareKeysForSamePlate(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            DROP INDEX IF EXISTS "IX_cars_Registration";
            DROP INDEX IF EXISTS ix_cars_registration;
            """);
    }

    private static void EnsureNoteColumn(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            ALTER TABLE cars ADD COLUMN IF NOT EXISTS "Note" character varying(2000);
            ALTER TABLE cars ALTER COLUMN "Note" TYPE character varying(2000);
            """);
    }

    private static void EnsureLogNoteColumn(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            ALTER TABLE IF EXISTS car_logs ADD COLUMN IF NOT EXISTS note character varying(2000);
            ALTER TABLE IF EXISTS car_logs ALTER COLUMN note TYPE character varying(2000);
            """);
    }

    private static void RenameLegacyKeyNames(AppDbContext db)
    {
        var cars = db.Cars.OrderBy(c => c.Id).ToList();
        if (cars.Count == 0 || cars.All(c => IsNewKey(c.KeyNumber)))
        {
            return;
        }

        var planned = new List<(Car Car, string Key, string Qr)>();
        var originalSlot = 1;
        var spareSlot = 1;
        var globalSlot = 1;

        foreach (var car in cars)
        {
            var kind = ResolveKind(car.KeyNumber, car.QrCode);
            var slot = kind == "Z" ? spareSlot++ : originalSlot++;
            var padded = slot.ToString("D2");
            planned.Add((car, $"K-{kind}-{padded}", BuildQrCode(globalSlot++, car.Registration)));
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

    private static void MigrateLegacyQrCodes(AppDbContext db)
    {
        var cars = db.Cars.OrderBy(c => c.Id).ToList();
        var changed = false;

        foreach (var car in cars)
        {
            if (IsPlateQr(car.QrCode))
            {
                continue;
            }

            var slot = ExtractSlotFromLegacyQr(car.QrCode) ?? ExtractSlotFromKey(car.KeyNumber);
            if (slot is null || slot <= 0)
            {
                continue;
            }

            var nextQr = BuildQrCode(slot.Value, car.Registration);
            if (!string.Equals(car.QrCode, nextQr, StringComparison.Ordinal))
            {
                car.QrCode = nextQr;
                changed = true;
            }
        }

        if (changed)
        {
            db.SaveChanges();
        }
    }

    // Aktualizuje suffix QR do 2 ostatnich liter/cyfr rejestracji (bez zmiany slotu).
    private static void SyncQrRegistrationSuffix(AppDbContext db)
    {
        var cars = db.Cars.OrderBy(c => c.Id).ToList();
        var used = new HashSet<string>(
            cars.Select(c => c.QrCode.Trim().ToUpperInvariant()),
            StringComparer.Ordinal);

        var changed = false;
        foreach (var car in cars)
        {
            var slot = ExtractSlotFromPlateQr(car.QrCode)
                ?? ExtractSlotFromLegacyQr(car.QrCode)
                ?? ExtractSlotFromKey(car.KeyNumber);
            if (slot is null || slot <= 0)
            {
                continue;
            }

            var nextQr = BuildQrCode(slot.Value, car.Registration);
            if (string.Equals(car.QrCode.Trim(), nextQr, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var nextKey = nextQr.ToUpperInvariant();
            var currentKey = car.QrCode.Trim().ToUpperInvariant();
            if (used.Contains(nextKey) && !string.Equals(nextKey, currentKey, StringComparison.Ordinal))
            {
                continue;
            }

            used.Remove(currentKey);
            used.Add(nextKey);
            car.QrCode = nextQr;
            changed = true;
        }

        if (changed)
        {
            db.SaveChanges();
        }
    }

    private static int? ExtractSlotFromPlateQr(string qrCode)
    {
        var match = Regex.Match(qrCode.Trim(), @"^(\d{2,3})[A-Za-z0-9]{2}$");
        return match.Success ? int.Parse(match.Groups[1].Value) : null;
    }

    private static bool IsNewKey(string value) => NewKeyRegex.IsMatch(value.Trim());

    private static bool IsPlateQr(string value) => PlateQrRegex.IsMatch(value.Trim());

    private static int? ExtractSlotFromKey(string keyNumber)
    {
        var match = NewKeyRegex.Match(keyNumber.Trim());
        return match.Success ? int.Parse(match.Groups[2].Value) : null;
    }

    private static int? ExtractSlotFromLegacyQr(string qrCode)
    {
        var match = LegacyQrRegex.Match(qrCode.Trim());
        return match.Success ? int.Parse(match.Groups[2].Value) : null;
    }

    // Format QR: numer slotu + 2 ostatnie znaki alfanumeryczne rejestracji.
    private static string BuildQrCode(int slot, string registration)
    {
        var xxx = slot >= 100 ? slot.ToString() : slot.ToString("D2");
        var chars = Regex.Replace(registration ?? string.Empty, @"[^A-Za-z0-9]", string.Empty).ToUpperInvariant();
        var yy = chars.Length >= 2 ? chars[^2..] : chars.PadLeft(2, '0');
        return $"{xxx}{yy}";
    }

    private static string ResolveKind(string key, string qr)
    {
        var keyMatch = NewKeyRegex.Match(key.Trim());
        if (keyMatch.Success)
        {
            return keyMatch.Groups[1].Value.ToUpperInvariant();
        }

        var qrMatch = LegacyQrRegex.Match(qr.Trim());
        if (qrMatch.Success)
        {
            return qrMatch.Groups[1].Value.ToUpperInvariant();
        }

        return key.Trim().StartsWith("K-Z-", StringComparison.OrdinalIgnoreCase) ? "Z" : "O";
    }
}
