using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SparkLoop.Application.Interfaces;
using SparkLoop.Infrastructure.BackgroundJobs;
using SparkLoop.Infrastructure.Persistence;
using SparkLoop.Infrastructure.RealTime;
using SparkLoop.Infrastructure.Services;
using SparkLoop.Infrastructure.Storage;

namespace SparkLoop.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Persistence - PostgreSQL
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=sparkloop;Username=sparkuser;Password=sparkpassword123!";

        services.AddDbContext<AppDbContext>(options =>
        {
            // If PostgreSQL is unavailable during initial local startup/tests, EF Core InMemory or standard Npgsql
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(3);
                npgsqlOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
            });
        });

        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());

        // Centrifugo RealTime
        services.AddHttpClient<ICentrifugoService, CentrifugoService>();

        // MinIO Blob Storage
        services.AddSingleton<IBlobStorageService, MinioStorageService>();

        // Redis Caching
        services.AddSingleton<ICacheService, RedisCacheService>();

        // Current User Context
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();

        // Background Workers
        services.AddHostedService<SparkRotationWorker>();
        services.AddHostedService<PodTtlCleanerWorker>();

        return services;
    }
}
