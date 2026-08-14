namespace AngularApp1.Server.Models;

public class Car
{
    public int Id { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Registration { get; set; } = string.Empty;
    public string KeyNumber { get; set; } = string.Empty;
    public string QrCode { get; set; } = string.Empty;
    public string Status { get; set; } = "FREE";
    public string? HeldBy { get; set; }
    public DateTime? TakenAt { get; set; }
    public string? ReturnedBy { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public DateTime? LostAt { get; set; }
    public string? LostBy { get; set; }
}

public class CarActionRequest
{
    public string QrCode { get; set; } = string.Empty;
}

public class CarWriteRequest
{
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Registration { get; set; } = string.Empty;
    public string KeyNumber { get; set; } = string.Empty;
    public string QrCode { get; set; } = string.Empty;
}

public class CarReturnByIdRequest
{
    public string LoginId { get; set; } = string.Empty;
}

public class CarLostRequest
{
    public string MarkedBy { get; set; } = string.Empty;
}
