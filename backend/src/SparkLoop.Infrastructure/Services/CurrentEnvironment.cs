using Microsoft.Extensions.Hosting;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.Services;

/// <summary>
/// Thin adapter around <see cref="IHostEnvironment"/> so that application-layer
/// handlers can ask about the ambient environment without taking a direct
/// dependency on Microsoft.AspNetCore.Hosting.
/// </summary>
public sealed class CurrentEnvironment : ICurrentEnvironment
{
    private readonly IHostEnvironment _hostEnvironment;

    public CurrentEnvironment(IHostEnvironment hostEnvironment)
    {
        _hostEnvironment = hostEnvironment;
    }

    public bool IsDevelopment() => _hostEnvironment.IsDevelopment();
    public bool IsProduction() => _hostEnvironment.IsProduction();
    public string EnvironmentName => _hostEnvironment.EnvironmentName;
}
