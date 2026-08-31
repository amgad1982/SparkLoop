using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using SparkLoop.Application.Common.Security;
using SparkLoop.Application.Interfaces;
using SparkLoop.Infrastructure.BackgroundJobs;
using SparkLoop.Infrastructure.Persistence;
using SparkLoop.Infrastructure.RealTime;
using SparkLoop.Infrastructure.Security;
using SparkLoop.Infrastructure.Security.OAuth;
using SparkLoop.Infrastructure.Services;
using SparkLoop.Infrastructure.Storage;
using StackExchange.Redis;
using ZiggyCreatures.Caching.Fusion;
using ZiggyCreatures.Caching.Fusion.Backplane.StackExchangeRedis;
using ZiggyCreatures.Caching.Fusion.Serialization.SystemTextJson;

namespace SparkLoop.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? "Host=localhost;Port=5432;Database=sparkloop;Username=sparkuser;Password=sparkpassword123!";

            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                // Keep retries low — 1 attempt avoids double-occupying pool slots during transient blips.
                // For longer outages the request fails fast and the client retries, which is preferable
                // to tying up connections while waiting.
                npgsqlOptions.EnableRetryOnFailure(1);
                npgsqlOptions.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName);
                npgsqlOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
                // Connection pool sizing — sized to match the expected per-replica concurrency.
                // When PgBouncer is in front of Postgres the pool can be smaller because PgBouncer
                // multiplexes many client connections onto a small set of server connections.
                npgsqlOptions.MaxBatchSize(100);
            });

            // Pool size & timeouts.
            options.EnableSensitiveDataLogging(false);
        });

        services.AddScoped<IAppDbContext>(p => p.GetRequiredService<AppDbContext>());

        // 1. JWT Security & Password Management
        var jwtSettings = new JwtSettings();
        configuration.GetSection(JwtSettings.SectionName).Bind(jwtSettings);
        services.Configure<JwtSettings>(configuration.GetSection(JwtSettings.SectionName));

        services.AddSingleton<IJwtTokenGenerator, JwtTokenService>();
        services.AddSingleton<IPasswordHasherService, PasswordHasherService>();
        services.AddSingleton<IRefreshTokenService, RefreshTokenService>();

        var key = Encoding.UTF8.GetBytes(jwtSettings.SecretKey);

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.RequireHttpsMetadata = false; // Set to true in strict TLS prod environments
            options.SaveToken = true;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidateAudience = true,
                ValidAudience = jwtSettings.Audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "unique_name",
                RoleClaimType = "role"
            };

            // Allow WebSocket authentication via query string (for real-time hubs if needed)
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    var path = context.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/ws"))
                    {
                        context.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });

        services.AddAuthorization();

        // 2. Centrifugo RealTime
        services.AddHttpClient<ICentrifugoService, CentrifugoService>();

        // 3. LiveKit SFU RealTime Voice
        services.AddSingleton<ILiveKitService, LiveKitService>();

        // 4. MinIO Blob Storage
        services.AddSingleton<IBlobStorageService, MinioStorageService>();

        // 5. FusionCache Hybrid Caching (L1 In-Memory + L2 Redis + Backplane)
        var redisConnectionString = configuration.GetConnectionString("Redis") ?? "localhost:6379,abortConnect=false";
        IConnectionMultiplexer? redisMultiplexer = null;

        try
        {
            var redisOptions = ConfigurationOptions.Parse(redisConnectionString);
            redisOptions.AbortOnConnectFail = false;
            redisOptions.ConnectTimeout = 3000;
            redisMultiplexer = ConnectionMultiplexer.Connect(redisOptions);
            services.AddSingleton<IConnectionMultiplexer>(redisMultiplexer);
        }
        catch (Exception)
        {
            // Redis connection failed; FusionCache will operate in in-memory L1 mode seamlessly
        }

        var fusionBuilder = services.AddFusionCache()
            .WithOptions(options =>
            {
                options.DefaultEntryOptions = new FusionCacheEntryOptions
                {
                    Duration = TimeSpan.FromSeconds(120),
                    FailSafeMaxDuration = TimeSpan.FromHours(1),
                    FailSafeThrottleDuration = TimeSpan.FromSeconds(30),
                    FactorySoftTimeout = TimeSpan.FromMilliseconds(500),
                    FactoryHardTimeout = TimeSpan.FromMilliseconds(3000),
                    EagerRefreshThreshold = 0.8f
                };
            })
            .WithSerializer(new FusionCacheSystemTextJsonSerializer(
                new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
                    PropertyNameCaseInsensitive = true
                }));

        if (redisMultiplexer != null)
        {
            try
            {
                fusionBuilder.WithBackplane(new RedisBackplane(
                    new RedisBackplaneOptions
                    {
                        Configuration = redisConnectionString
                    }));
            }
            catch (Exception)
            {
                // Fallback to local backplane if Redis backplane initialization fails
            }
        }

        services.AddSingleton<ICacheService, FusionCacheService>();

        // 6. Current User Context
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddSingleton<ICurrentEnvironment, CurrentEnvironment>();

        // 7. OAuth Provider Services
        services.Configure<OAuthSettings>(configuration.GetSection(OAuthSettings.SectionName));
        services.AddHttpClient();
        services.AddScoped<IOAuthService, OAuthService>();

        // 8. Background Workers
        services.AddHostedService<SparkRotationWorker>();
        services.AddHostedService<PodTtlCleanerWorker>();

        return services;
    }
}
