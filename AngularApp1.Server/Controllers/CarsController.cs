using System.Security.Claims;
using AngularApp1.Server.Models;
using AngularApp1.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AngularApp1.Server.Controllers;

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
    [Authorize(Roles = "Admin")]
    public ActionResult<IEnumerable<Car>> GetAll() => Ok(_cars.GetAll());

    [HttpGet("registry")]
    [Authorize(Roles = "Admin")]
    public ActionResult<IEnumerable<Car>> GetRegistry() => Ok(_cars.GetRegistry());

    [HttpGet("by-qr/{code}")]
    public ActionResult<Car> GetByQr(string code)
    {
        var car = _cars.FindByQrCode(code);
        return car is null ? NotFound(new { message = "Nie znaleziono kluczyka." }) : Ok(car);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> Create([FromBody] CarWriteRequest request)
    {
        var (car, error) = _cars.Create(request);
        return error is null ? Created($"/api/cars/{car!.Id}", car) : BadRequest(new { message = error });
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> Update(int id, [FromBody] CarWriteRequest request)
    {
        var (car, error) = _cars.Update(id, request);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        return car is null ? NotFound(new { message = "Nie znaleziono auta." }) : Ok(car);
    }

    [HttpPost("{id:int}/note")]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> UpdateNote(int id, [FromBody] CarNoteRequest? request)
    {
        var (car, error) = _cars.UpdateNote(id, request?.Note);
        if (error is not null)
        {
            return BadRequest(new { message = error });
        }

        return car is null ? NotFound(new { message = "Nie znaleziono auta." }) : Ok(car);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public ActionResult Delete(int id)
    {
        var (ok, error) = _cars.Delete(id);
        if (!ok)
        {
            return error?.Contains("użyciu") == true
                ? Conflict(new { message = error })
                : BadRequest(new { message = error });
        }

        return NoContent();
    }

    [HttpPost("take")]
    public ActionResult<Car> Take([FromBody] CarActionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QrCode))
        {
            return BadRequest(new { message = "Brak kodu QR." });
        }

        var loginId = GetLoginId();
        var (car, error) = _cars.Take(request.QrCode, loginId);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    [HttpPost("return")]
    public ActionResult<Car> Return([FromBody] CarActionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.QrCode))
        {
            return BadRequest(new { message = "Brak kodu QR." });
        }

        var loginId = GetLoginId();
        var (car, error) = _cars.Return(request.QrCode, loginId);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    [HttpPost("{id:int}/return")]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> ReturnById(int id, [FromBody] CarReturnByIdRequest request)
    {
        var loginId = string.IsNullOrWhiteSpace(request.LoginId)
            ? GetLoginId()
            : request.LoginId.Trim();

        var (car, error) = _cars.ReturnById(id, loginId);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    [HttpPost("{id:int}/lost")]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> MarkLost(int id, [FromBody] CarLostRequest request)
    {
        var markedBy = string.IsNullOrWhiteSpace(request.MarkedBy)
            ? GetLoginId()
            : request.MarkedBy.Trim();

        var (car, error) = _cars.MarkLost(id, markedBy);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    [HttpPost("{id:int}/found")]
    [Authorize(Roles = "Admin")]
    public ActionResult<Car> MarkFound(int id)
    {
        var (car, error) = _cars.MarkFound(id);
        return error is null ? Ok(car) : BadRequest(new { message = error });
    }

    private string GetLoginId() =>
        User.FindFirstValue(ClaimTypes.Name) ??
        User.Identity?.Name ??
        "unknown";

    [HttpGet("{id:int}/history")]
    [Authorize(Roles = "Admin")]
    public ActionResult<IEnumerable<CarHistoryRecord>> GetHistory(int id) =>
    Ok(_cars.GetHistory(id));
}
