using AngularApp1.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace AngularApp1.Server.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Car> Cars => Set<Car>();
    public DbSet<CarLog> CarLogs => Set<CarLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Car>(entity =>
        {
            entity.ToTable("cars");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Brand).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Model).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Registration).HasMaxLength(30).IsRequired();
            entity.Property(x => x.KeyNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.QrCode).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Status).HasMaxLength(20).IsRequired();
            entity.Property(x => x.HeldBy).HasMaxLength(255);
            entity.Property(x => x.ReturnedBy).HasMaxLength(255);
            entity.Property(x => x.LostBy).HasMaxLength(255);
            entity.HasIndex(x => x.QrCode).IsUnique();
            entity.HasIndex(x => x.Registration).IsUnique();
        });

        modelBuilder.Entity<CarLog>(entity =>
        {
            entity.ToTable("car_logs");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Username).HasMaxLength(255).IsRequired();
            entity.Property(x => x.Action).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Timestamp).IsRequired();
        });
    }
}