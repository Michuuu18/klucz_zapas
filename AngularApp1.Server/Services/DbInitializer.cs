using AngularApp1.Server.Data;
using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AngularApp1.Server.Services;

public static class DbInitializer
{
    public static void Initialize(AppDbContext db)
    {
        // Jak w kursie RestaurantAPI: schemat bazy tworzony przez migracje EF Core
        db.Database.Migrate();

        if (db.Cars.Any())
        {
            return;
        }

        db.Cars.AddRange(
            new Car { Brand = "Toyota Corolla", Registration = "BB 1234A", KeyNumber = "K-001", QrCode = "QR001", Status = "FREE" },
            new Car { Brand = "Volkswagen Passat", Registration = "BB 5678B", KeyNumber = "K-002", QrCode = "QR002", Status = "FREE" },
            new Car { Brand = "Skoda Octavia", Registration = "SB 9012C", KeyNumber = "K-003", QrCode = "QR003", Status = "FREE" },
            new Car { Brand = "Ford Transit", Registration = "BB 3456D", KeyNumber = "K-004", QrCode = "QR004", Status = "FREE" },
            new Car { Brand = "BMW 320d", Registration = "KR 7890E", KeyNumber = "K-005", QrCode = "QR005", Status = "FREE" },
             new Car { Brand = "BMW 335i", Registration = "SZ 9707", KeyNumber = "K-006", QrCode = "QR006", Status = "FREE" }
        );

        db.SaveChanges();
    }
}
