namespace AngularApp1.Server.Models;

public class CarHistoryRecord
{
    public int Id { get; set; }
    public int CarId { get; set; }
    public string User { get; set; } = string.Empty;
    public string UserDisplayName { get; set; } = string.Empty;
    public DateTime TakenAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
    public string? ReturnedBy { get; set; }
    public string? ReturnedByDisplayName { get; set; }
    public int? DurationMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
}
