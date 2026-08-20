using System.Net;
using System.Text.Json;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Api.Middlewares;

public class GlobalExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlingMiddleware> _logger;

    public GlobalExceptionHandlingMiddleware(RequestDelegate _next, ILogger<GlobalExceptionHandlingMiddleware> logger)
    {
        this._next = _next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/problem+json";

        var (statusCode, problemDetails) = exception switch
        {
            DomainRuleException domainEx => (
                HttpStatusCode.BadRequest,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.BadRequest,
                    Title = "Domain Rule Violation",
                    Detail = domainEx.Message,
                    Extensions = { ["errorCode"] = domainEx.Code }
                }
            ),
            ConcurrencyException concurrencyEx => (
                HttpStatusCode.Conflict,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.Conflict,
                    Title = "Concurrency Conflict",
                    Detail = concurrencyEx.Message,
                    Extensions = { ["errorCode"] = "CONCURRENCY_CONFLICT" }
                }
            ),
            NotFoundException notFoundEx => (
                HttpStatusCode.NotFound,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.NotFound,
                    Title = "Resource Not Found",
                    Detail = notFoundEx.Message,
                    Extensions = { ["errorCode"] = "NOT_FOUND" }
                }
            ),
            ValidationException validationEx => (
                HttpStatusCode.BadRequest,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.BadRequest,
                    Title = "Validation Failed",
                    Detail = "One or more validation errors occurred.",
                    Extensions =
                    {
                        ["errors"] = validationEx.Errors.Select(e => new { e.PropertyName, e.ErrorMessage })
                    }
                }
            ),
            UnauthorizedDomainException unauthEx => (
                HttpStatusCode.Forbidden,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.Forbidden,
                    Title = "Forbidden",
                    Detail = unauthEx.Message,
                    Extensions = { ["errorCode"] = "FORBIDDEN" }
                }
            ),
            _ => (
                HttpStatusCode.InternalServerError,
                new ProblemDetails
                {
                    Status = (int)HttpStatusCode.InternalServerError,
                    Title = "Internal Server Error",
                    Detail = "An unexpected error occurred. Please try again later."
                }
            )
        };

        context.Response.StatusCode = (int)statusCode;
        var json = JsonSerializer.Serialize(problemDetails);
        await context.Response.WriteAsync(json);
    }
}

public class RTLContextMiddleware
{
    private readonly RequestDelegate _next;

    public RTLContextMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var locale = context.Request.Headers["X-App-Locale"].FirstOrDefault()
            ?? context.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()
            ?? "en";

        var isRtl = locale.StartsWith("ar", StringComparison.OrdinalIgnoreCase);

        context.Response.Headers["X-Text-Direction"] = isRtl ? "rtl" : "ltr";
        context.Response.Headers["X-App-Locale"] = isRtl ? "ar" : "en";

        await _next(context);
    }
}
