using AngularApp1.Server.Models;

namespace AngularApp1.Server.Services;

public class CarStore
{
    private readonly List<Car> _cars =
    [
        new() { Id = 1, Brand = "Toyota Corolla", Registration = "BB 1234A", KeyNumber = "K-001", QrCode = "QR001", Status = "FREE" },
        new() { Id = 2, Brand = "Volkswagen Passat", Registration = "BB 5678B", KeyNumber = "K-002", QrCode = "QR002", Status = "FREE" },
        new() { Id = 3, Brand = "Skoda Octavia", Registration = "SB 9012C", KeyNumber = "K-003", QrCode = "QR003", Status = "FREE" },
        new() { Id = 4, Brand = "Ford Transit", Registration = "BB 3456D", KeyNumber = "K-004", QrCode = "QR004", Status = "FREE" },
        new() { Id = 5, Brand = "BMW 320d", Registration = "KR 7890E", KeyNumber = "K-005", QrCode = "QR005", Status = "FREE" },
    ];

    private readonly object _lock = new();

    public IReadOnlyList<Car> GetAll()
    {
        lock (_lock)
        {
            return _cars.Select(Clone).ToList();
        }
    }

    public Car? FindByQrCode(string qrCode)
    {
        lock (_lock)
        {
            var car = _cars.FirstOrDefault(c =>
                string.Equals(c.QrCode, qrCode.Trim(), StringComparison.OrdinalIgnoreCase));
            return car is null ? null : Clone(car);
        }
    }

    public (Car? car, string? error) Take(string qrCode)
    {
        lock (_lock)
        {
            var car = FindInternal(qrCode);
            if (car is null)
            {
                return (null, "Nie znaleziono kluczyka.");
            }

            if (car.Status == "IN_USE")
            {
                return (null, "To auto jest już zabrane.");
            }

            car.Status = "IN_USE";
            return (Clone(car), null);
        }
    }

    public (Car? car, string? error) Return(string qrCode)
    {
        lock (_lock)
        {
            var car = FindInternal(qrCode);
            if (car is null)
            {
                return (null, "Nie znaleziono kluczyka.");
            }

            if (car.Status == "FREE")
            {
                return (null, "To auto jest już oddane.");
            }

            car.Status = "FREE";
            return (Clone(car), null);
        }
    }

    private Car? FindInternal(string qrCode) =>
        _cars.FirstOrDefault(c =>
            string.Equals(c.QrCode, qrCode.Trim(), StringComparison.OrdinalIgnoreCase));

    private static Car Clone(Car car) => new()
    {
        Id = car.Id,
        Brand = car.Brand,
        Registration = car.Registration,
        KeyNumber = car.KeyNumber,
        QrCode = car.QrCode,
        Status = car.Status,
    };
}
