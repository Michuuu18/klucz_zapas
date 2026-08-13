using AngularApp1.Server.Models;
using AngularApp1.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AngularApp1.Server.Controllers;

/// <summary>
/// Endpointy aut — chronione JWT jak RestaurantController [Authorize] w kursie.
/// </summary>
[ApiController]
[Route("api/cars")]
[Authorize]
public class CarsController : ControllerBase
{
    private readonly CarStore _cars;

    public CarsController(CarStore cars)
    {
        _cars = cars;
    }

    [HttpGet]
    public ActionResult<IEnumerable<Car>> GetAll() => Ok(_cars.GetAll());

    [HttpGet("by-qr/{code}")]
    public ActionResult<Car> GetByQr(string code)
    {
        var car = _cars.FindByQrCode(code);
        return car is null ? NotFound(new { message = "Nie znaleziono kluczyka." }) : Ok(car);
    }

    [HttpPost("take")]
    public ActionResult<Car> Take([FromBody] CarActionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QrCode))
        {
            return BadRequest(new { message = "Brak kodu QR." });
        }

        var (car, error) = _cars.Take(request.QrCode);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    [HttpPost("return")]
    public ActionResult<Car> Return([FromBody] CarActionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QrCode))
        {
            return BadRequest(new { message = "Brak kodu QR." });
        }

        var (car, error) = _cars.Return(request.QrCode);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }
}
