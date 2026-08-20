using AngularApp1.Server.Data;
using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.Extensions.Logging;

namespace AngularApp1.Server.Services;

public class CarStore
{
    private readonly AppDbContext _db;
    private readonly UserStore _users;
    private readonly ILogger<CarStore> _logger;

    public CarStore(AppDbContext db, UserStore users, ILogger<CarStore> logger)
    {
        _db = db;
        _users = users;
        _logger = logger;
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

        try
        {
            _db.CarLogs.Add(new CarLog
            {
                CarId = car.Id,
                Username = loginId,
                Action = "TAKE",
                Timestamp = DateTime.UtcNow,
            });
            _db.SaveChanges();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam log historii (brak tabeli car_logs). Akcja TAKE carId={CarId}", car.Id);
        }
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
        car.LostAt = null;
        car.LostBy = null;
        car.ReturnedBy = loginId;
        car.ReturnedAt = DateTime.UtcNow;
        var returnNote = string.IsNullOrWhiteSpace(car.Note) ? null : car.Note.Trim();
        car.Note = null;

        _db.SaveChanges();

        try
        {
            _db.CarLogs.Add(new CarLog
            {
                CarId = car.Id,
                Username = loginId,
                Action = "RETURN",
                Timestamp = DateTime.UtcNow,
                Note = returnNote,
            });
            _db.SaveChanges();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam log historii (brak tabeli car_logs). Akcja RETURN carId={CarId}", car.Id);
        }
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
        var returnNote = string.IsNullOrWhiteSpace(car.Note) ? null : car.Note.Trim();
        car.Note = null;
        _db.SaveChanges();

        try
        {
            _db.CarLogs.Add(new CarLog
            {
                CarId = car.Id,
                Username = loginId,
                Action = "RETURN",
                Timestamp = DateTime.UtcNow,
                Note = returnNote,
            });
            _db.SaveChanges();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam log historii (brak tabeli car_logs). Akcja RETURN(byId) carId={CarId}", car.Id);
        }
        return (car, null);
    }

    public (Car? car, string? error) Create(CarWriteRequest request)
    {
        var payload = NormalizePayload(request);
        if (payload.error is not null)
        {
            return (null, payload.error);
        }

        if (PlateKindExists(payload.data!.Registration, payload.data.KeyNumber))
        {
            var kind = GetKeyKind(payload.data.KeyNumber);
            return (null, kind == "Z"
                ? "Ten pojazd ma już klucz zapasowy."
                : "Ten pojazd ma już klucz oryginalny.");
        }

        if (KeyNumberExists(payload.data.KeyNumber))
        {
            return (null, "Ta nazwa kluczyka jest już używana.");
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

        var newPlate = request.Registration?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(newPlate))
        {
            return (null, "Podaj nowe tablice rejestracyjne.");
        }

        var keyNumber = string.IsNullOrWhiteSpace(request.KeyNumber) ? car.KeyNumber : request.KeyNumber.Trim();
        var qrCode = string.IsNullOrWhiteSpace(request.QrCode) ? car.QrCode : request.QrCode.Trim();
        var brand = string.IsNullOrWhiteSpace(request.Brand) ? car.Brand : request.Brand.Trim();
        var model = string.IsNullOrWhiteSpace(request.Model) ? car.Model : request.Model.Trim();
        if (string.IsNullOrWhiteSpace(model))
        {
            model = "—";
        }

        var oldPlate = car.Registration.Trim().ToUpperInvariant();
        var group = _db.Cars
            .Where(c => c.Registration.ToUpper() == oldPlate)
            .ToList();
        var groupIds = group.Select(c => c.Id).ToHashSet();

        if (PlateKindExists(newPlate, car.KeyNumber, groupIds))
        {
            var kind = GetKeyKind(car.KeyNumber);
            return (null, kind == "Z"
                ? "Ten pojazd ma już klucz zapasowy z takimi tablicami."
                : "Ten pojazd ma już klucz oryginalny z takimi tablicami.");
        }

        if (KeyNumberExists(keyNumber, id))
        {
            return (null, "Ta nazwa kluczyka jest już używana.");
        }

        if (QrExists(qrCode, id))
        {
            return (null, "Ten kod QR jest już przypisany do innego kluczyka.");
        }

        car.Brand = brand;
        car.Model = model;
        car.KeyNumber = keyNumber;
        car.QrCode = qrCode;

        foreach (var member in group)
        {
            member.Registration = newPlate;
        }

        _db.SaveChanges();
        return (car, null);
    }

    public (Car? car, string? error) UpdateNote(int id, string? note)
    {
        var car = _db.Cars.FirstOrDefault(c => c.Id == id);
        if (car is null)
        {
            return (null, "Nie znaleziono auta.");
        }

        var value = (note ?? string.Empty).Trim();
        if (value.Length > 2000)
        {
            return (null, "Notatka jest za długa (max 2000 znaków).");
        }

        car.Note = string.IsNullOrEmpty(value) ? null : value;

        try
        {
            var takeLog = _db.CarLogs
                .Where(l => l.CarId == id && l.Action == "TAKE")
                .OrderByDescending(l => l.Timestamp)
                .FirstOrDefault();

            if (takeLog is not null)
            {
                takeLog.Note = car.Note;
            }
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam zapis notatki w historii (brak tabeli car_logs). carId={CarId}", id);
        }

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

        try
        {
            _db.CarLogs.Add(new CarLog
            {
                CarId = car.Id,
                Username = markedBy,
                Action = "LOST",
                Timestamp = DateTime.UtcNow,
            });
            _db.SaveChanges();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam log historii (brak tabeli car_logs). Akcja LOST carId={CarId}", car.Id);
        }
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

        try
        {
            _db.CarLogs.Add(new CarLog
            {
                CarId = car.Id,
                Username = "system",
                Action = "FOUND",
                Timestamp = DateTime.UtcNow,
            });
            _db.SaveChanges();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            _logger.LogWarning("Pomijam log historii (brak tabeli car_logs). Akcja FOUND carId={CarId}", car.Id);
        }
        return (car, null);
    }

    private Car? FindTracked(string qrCode)
    {
        var code = qrCode.Trim().ToLowerInvariant();
        return _db.Cars.FirstOrDefault(c => c.QrCode.ToLower() == code);
    }

    private bool PlateKindExists(string plate, string keyNumber, int? excludeId = null)
        => PlateKindExists(plate, keyNumber, excludeId is null ? [] : [excludeId.Value]);

    private bool PlateKindExists(string plate, string keyNumber, IReadOnlyCollection<int> excludeIds)
    {
        var normalized = plate.ToUpperInvariant();
        var kind = GetKeyKind(keyNumber);

        return _db.Cars
            .Where(c => c.Registration.ToUpper() == normalized && !excludeIds.Contains(c.Id))
            .AsEnumerable()
            .Any(c => GetKeyKind(c.KeyNumber) == kind);
    }

    private bool KeyNumberExists(string keyNumber, int? excludeId = null)
    {
        var normalized = keyNumber.Trim().ToUpperInvariant();
        return _db.Cars.Any(c =>
            c.KeyNumber.ToUpper() == normalized &&
            (!excludeId.HasValue || c.Id != excludeId.Value));
    }

    private static string GetKeyKind(string keyNumber)
    {
        var value = keyNumber.Trim().ToUpperInvariant();
        return value.StartsWith("K-Z-", StringComparison.Ordinal) ? "Z" : "O";
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
            Brand = request.Brand?.Trim() ?? string.Empty,
            Model = request.Model?.Trim() ?? string.Empty,
            Registration = request.Registration?.Trim().ToUpperInvariant() ?? string.Empty,
            KeyNumber = request.KeyNumber?.Trim() ?? string.Empty,
            QrCode = request.QrCode?.Trim() ?? string.Empty,
        };

        if (string.IsNullOrWhiteSpace(data.Brand) ||
            string.IsNullOrWhiteSpace(data.Registration) ||
            string.IsNullOrWhiteSpace(data.KeyNumber) ||
            string.IsNullOrWhiteSpace(data.QrCode))
        {
            return (null, "Uzupełnij markę, tablice, nazwę kluczyka i kod QR.");
        }

        return (data, null);
    }
    public IReadOnlyList<CarHistoryRecord> GetHistory(int carId)
    {
        var cutoff = DateTime.UtcNow.AddDays(-30);
        List<CarLog> logs;
        try
        {
            logs = _db.CarLogs
                .AsNoTracking()
                .Where(l => l.CarId == carId && l.Timestamp >= cutoff)
                .OrderBy(l => l.Timestamp)
                .ToList();
        }
        catch (PostgresException ex) when (ex.SqlState == "42P01")
        {
            // 42P01 = undefined_table. Jeśli ktoś nie odpalił migracji (tabela car_logs),
            // to zamiast wywalać UI zwracamy pustą historię.
            return [];
        }

        var sessions = new List<CarHistoryRecord>();
        CarHistoryRecord? open = null;

        foreach (var log in logs)
        {
            if (log.Action == "TAKE")
            {
                open = new CarHistoryRecord
                {
                    Id = log.Id,
                    CarId = carId,
                    User = log.Username,
                    UserDisplayName = GetDisplayName(log.Username),
                    TakenAt = log.Timestamp,
                    ReturnedAt = null,
                    ReturnedBy = null,
                    ReturnedByDisplayName = null,
                    DurationMinutes = null,
                    Status = "W użyciu",
                    Note = log.Note,
                };
                sessions.Add(open);
            }
            else if (log.Action == "RETURN")
            {
                if (open is not null && open.ReturnedAt is null)
                {
                    open.ReturnedAt = log.Timestamp;
                    open.ReturnedBy = log.Username;
                    open.ReturnedByDisplayName = GetDisplayName(log.Username);
                    open.DurationMinutes = (int)Math.Round((log.Timestamp - open.TakenAt).TotalMinutes);
                    open.Status = "Zwrócony";
                    if (!string.IsNullOrWhiteSpace(log.Note))
                    {
                        open.Note = log.Note;
                    }
                    open = null;
                }
                else
                {
                    sessions.Add(new CarHistoryRecord
                    {
                        Id = log.Id,
                        CarId = carId,
                        User = log.Username,
                        UserDisplayName = GetDisplayName(log.Username),
                        TakenAt = log.Timestamp,
                        ReturnedAt = log.Timestamp,
                        ReturnedBy = log.Username,
                        ReturnedByDisplayName = GetDisplayName(log.Username),
                        DurationMinutes = 0,
                        Status = "Zwrócony",
                        Note = log.Note,
                    });
                }
            }
        }

        sessions.Reverse(); 
        return sessions;
    }

    private string GetDisplayName(string username)
    {
        return _users.FindByUsername(username)?.DisplayName ?? username;
    }
}
