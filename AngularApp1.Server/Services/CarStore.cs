using AngularApp1.Server.Data;
using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AngularApp1.Server.Services;

public class CarStore
{
    private readonly AppDbContext _db;

    public CarStore(AppDbContext db)
    {
        _db = db;
    }

    public IReadOnlyList<Car> GetAll()
    {
        return _db.Cars
            .AsNoTracking()
            .OrderBy(c => c.Id)
            .ToList();
    }

    public Car? FindByQrCode(string qrCode)
    {
        var code = qrCode.Trim().ToLowerInvariant();
        return _db.Cars
            .AsNoTracking()
            .FirstOrDefault(c => c.QrCode.ToLower() == code);
    }

    public (Car? car, string? error) Take(string qrCode)
    {
        var car = FindTracked(qrCode);
        if (car is null)
        {
            return (null, "Nie znaleziono kluczyka.");
        }

        if (car.Status == "IN_USE")
        {
            return (null, "To auto jest już zabrane.");
        }

        car.Status = "IN_USE";
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) Return(string qrCode)
    {
        var car = FindTracked(qrCode);
        if (car is null)
        {
            return (null, "Nie znaleziono kluczyka.");
        }

        if (car.Status == "FREE")
        {
            return (null, "To auto jest już oddane.");
        }

        car.Status = "FREE";
        _db.SaveChanges();
        return (car, null);
    }

    private Car? FindTracked(string qrCode)
    {
        var code = qrCode.Trim().ToLowerInvariant();
        return _db.Cars.FirstOrDefault(c => c.QrCode.ToLower() == code);
    }
}
