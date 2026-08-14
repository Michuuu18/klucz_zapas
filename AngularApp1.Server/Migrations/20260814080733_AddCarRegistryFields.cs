using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AngularApp1.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddCarRegistryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "HeldBy",
                table: "cars",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LostAt",
                table: "cars",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LostBy",
                table: "cars",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "cars",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReturnedAt",
                table: "cars",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReturnedBy",
                table: "cars",
                type: "character varying(255)",
                maxLength: 255,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TakenAt",
                table: "cars",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_cars_Registration",
                table: "cars",
                column: "Registration",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_cars_Registration",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "HeldBy",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "LostAt",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "LostBy",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "ReturnedAt",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "ReturnedBy",
                table: "cars");

            migrationBuilder.DropColumn(
                name: "TakenAt",
                table: "cars");
        }
    }
}
