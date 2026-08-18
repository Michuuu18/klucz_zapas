namespace AngularApp1.Server.Models;

public class CarHistoryRecord
{
    public int Id { get; set; }
    public string User { get; set; } = string.Empty;
    public DateTime TakenAt { get; set; }
    public DateTime? ReturnedAt { get; set; }
}
