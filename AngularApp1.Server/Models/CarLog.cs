public class CarLog
{
    public int Id { get; set; }
    public int CarId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; 
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}