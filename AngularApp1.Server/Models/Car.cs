namespace AngularApp1.Server.Models;

public class Car
{
    public int Id { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Registration { get; set; } = string.Empty;
    public string KeyNumber { get; set; } = string.Empty;
    public string QrCode { get; set; } = string.Empty;
    public string Status { get; set; } = "FREE";
}

public class CarActionRequest
{
    public string QrCode { get; set; } = string.Empty;
}
