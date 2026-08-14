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

    public IReadOnlyList<Car> GetRegistry()
    {
        return _db.Cars
            .AsNoTracking()
            .OrderBy(c => c.Status == "IN_USE" ? 0 : 1)
            .ThenByDescending(c => c.TakenAt)
            .ThenBy(c => c.Id)
            .ToList();
    }

    public Car? FindByQrCode(string qrCode)
    {
        var code = qrCode.Trim().ToLowerInvariant();
        return _db.Cars
            .AsNoTracking()
            .FirstOrDefault(c => c.QrCode.ToLower() == code);
    }

    public Car? FindById(int id) =>
        _db.Cars.AsNoTracking().FirstOrDefault(c => c.Id == id);

    public (Car? car, string? error) Take(string qrCode, string loginId)
    {
        var car = FindTracked(qrCode);
        if (car is null)
        {
            return (null, "Nie znaleziono kluczyka.");
        }

        if (car.Status == "LOST")
        {
            return (null, "Kluczyk jest oznaczony jako zagubiony.");
        }

        if (car.Status == "IN_USE")
        {
            return (null, "To auto jest już zabrane.");
        }

        car.Status = "IN_USE";
        car.HeldBy = loginId;
        car.TakenAt = DateTime.UtcNow;
        car.ReturnedBy = null;
        car.ReturnedAt = null;
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) Return(string qrCode, string loginId)
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
        car.HeldBy = null;
        car.TakenAt = null;
        car.ReturnedBy = loginId;
        car.ReturnedAt = DateTime.UtcNow;
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) ReturnById(int id, string loginId)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (null, "Nie znaleziono auta.");
        }

        if (car.Status != "IN_USE")
        {
            return (null, "Auto nie jest aktualnie w użyciu.");
        }

        car.Status = "FREE";
        car.HeldBy = null;
        car.TakenAt = null;
        car.ReturnedBy = loginId;
        car.ReturnedAt = DateTime.UtcNow;
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) Create(CarWriteRequest request)
    {
        var payload = NormalizePayload(request);
        if (payload.error is not null)
        {
            return (null, payload.error);
        }

        if (PlateExists(payload.data!.Registration))
        {
            return (null, "Tablice rejestracyjne już istnieją w systemie.");
        }

        if (QrExists(payload.data.QrCode))
        {
            return (null, "Ten kod QR jest już przypisany do innego kluczyka.");
        }

        var car = new Car
        {
            Brand = payload.data.Brand,
            Model = payload.data.Model,
            Registration = payload.data.Registration,
            KeyNumber = payload.data.KeyNumber,
            QrCode = payload.data.QrCode,
            Status = "FREE",
        };

        _db.Cars.Add(car);
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) Update(int id, CarWriteRequest request)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (null, "Nie znaleziono auta.");
        }

        var payload = NormalizePayload(request);
        if (payload.error is not null)
        {
            return (null, payload.error);
        }

        if (PlateExists(payload.data!.Registration, id))
        {
            return (null, "Tablice rejestracyjne już istnieją w systemie.");
        }

        if (QrExists(payload.data.QrCode, id))
        {
            return (null, "Ten kod QR jest już przypisany do innego kluczyka.");
        }

        car.Brand = payload.data.Brand;
        car.Model = payload.data.Model;
        car.Registration = payload.data.Registration;
        car.KeyNumber = payload.data.KeyNumber;
        car.QrCode = payload.data.QrCode;
        _db.SaveChanges();
        return (car, null);
    }

    public (bool ok, string? error) Delete(int id)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (false, "Nie znaleziono auta.");
        }

        if (car.Status == "IN_USE")
        {
            return (false, "Nie można usunąć auta, które jest aktualnie w użyciu.");
        }

        _db.Cars.Remove(car);
        _db.SaveChanges();
        return (true, null);
    }

    public (Car? car, string? error) MarkLost(int id, string markedBy)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (null, "Nie znaleziono auta.");
        }

        if (car.Status == "LOST")
        {
            return (null, "Kluczyk jest już oznaczony jako zagubiony.");
        }

        car.Status = "LOST";
        car.HeldBy = null;
        car.TakenAt = null;
        car.LostAt = DateTime.UtcNow;
        car.LostBy = markedBy;
        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) MarkFound(int id)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (null, "Nie znaleziono auta.");
        }

        if (car.Status != "LOST")
        {
            return (null, "Kluczyk nie jest oznaczony jako zagubiony.");
        }

        car.Status = "FREE";
        car.LostAt = null;
        car.LostBy = null;
        _db.SaveChanges();
        return (car, null);
    }

    private Car? FindTracked(string qrCode)
    {
        var code = qrCode.Trim().ToLowerInvariant();
        return _db.Cars.FirstOrDefault(c => c.QrCode.ToLower() == code);
    }

    private bool PlateExists(string plate, int? excludeId = null)
    {
        var normalized = plate.ToUpperInvariant();
        return _db.Cars.Any(c =>
            c.Registration.ToUpper() == normalized &&
            (!excludeId.HasValue || c.Id != excludeId.Value));
    }

    private bool QrExists(string qrCode, int? excludeId = null)
    {
        var normalized = qrCode.ToLowerInvariant();
        return _db.Cars.Any(c =>
            c.QrCode.ToLower() == normalized &&
            (!excludeId.HasValue || c.Id != excludeId.Value));
    }

    private static (CarWriteRequest? data, string? error) NormalizePayload(CarWriteRequest request)
    {
        var data = new CarWriteRequest
        {
            Brand = request.Brand.Trim(),
            Model = request.Model.Trim(),
            Registration = request.Registration.Trim().ToUpperInvariant(),
            KeyNumber = request.KeyNumber.Trim(),
            QrCode = request.QrCode.Trim(),
        };

        if (string.IsNullOrWhiteSpace(data.Brand) ||
            string.IsNullOrWhiteSpace(data.Model) ||
            string.IsNullOrWhiteSpace(data.Registration) ||
            string.IsNullOrWhiteSpace(data.KeyNumber) ||
            string.IsNullOrWhiteSpace(data.QrCode))
        {
            return (null, "Uzupełnij wszystkie pola formularza.");
        }

        return (data, null);
    }
}
