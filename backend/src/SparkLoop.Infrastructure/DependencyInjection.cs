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
        var provider = configuration["DatabaseProvider"] ?? "Sqlite";

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection")
                    ?? "Host=localhost;Port=5432;Database=sparkloop;Username=sparkuser;Password=sparkpassword123!";

                options.UseNpgsql(connectionString, npgsqlOptions =>
                {
                    npgsqlOptions.EnableRetryOnFailure(3);
                    npgsqlOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                });
            }
            else
            {
                // Zero-config SQLite provider for seamless instant local testing & offline development
                var sqliteConn = configuration.GetConnectionString("Sqlite") ?? "Data Source=sparkloop.db";
                options.UseSqlite(sqliteConn, sqliteOptions =>
                {
                    sqliteOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                    sqliteOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                });
            }
        });

        services.AddScoped<IAppDbContext>(p => p.GetRequiredService<AppDbContext>());

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
