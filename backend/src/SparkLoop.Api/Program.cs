using Microsoft.OpenApi.Models;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using SparkLoop.Api.Middlewares;
using SparkLoop.Api.Persistence;
using SparkLoop.Api.RateLimiting;
using SparkLoop.Api.Security;
using SparkLoop.Application;
using SparkLoop.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// =========================================================================
// 0. Refuse to start in Production when in-repo placeholder secrets are set.
// =========================================================================
SecretValidation.EnsureProductionSecretsAreConfigured(builder.Configuration, builder.Environment);

// 1. Add Application & Infrastructure Services
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// 2. Add Controllers & JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// 3. Configure Secure CORS for React Vite Frontend
var allowedOrigins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? new[]
{
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:7070",
    "http://127.0.0.1:7070",
    "https://sloop.mydev-lab.com"
};

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// 4. Swagger / OpenAPI Configuration with JWT Bearer Scheme
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "SparkLoop API",
        Version = "v1",
        Description = "Secure Domain-Driven Design (DDD) & CQRS Backend for SparkLoop social micro-blogging and interactive entertainment platform."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header
            },
            new List<string>()
        }
    });
});

// 5. Rate limiting — protects login, posts, reactions, media uploads and pod audio chunks.
builder.Services.AddSparkLoopRateLimiting();

// 6. OpenTelemetry — traces for every request + outbound HTTP, metrics scraped by Prometheus.
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r
        .AddService(serviceName: "sparkloop-api", serviceVersion: "1.0.0")
        .AddAttributes(new KeyValuePair<string, object>[]
        {
            new("deployment.environment", builder.Environment.EnvironmentName)
        }))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(o =>
        {
            // Don't trace the metrics scrape itself, otherwise Prometheus pulls show as spans.
            o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/metrics");
        })
        .AddHttpClientInstrumentation())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddPrometheusExporter());

var app = builder.Build();

// 7. Configure Middleware Pipeline
app.UseMiddleware<GlobalExceptionHandlingMiddleware>();

// Security Response Headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
    // HSTS in production — strict HTTPS for one year, subdomains included.
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    }
    await next();
});

// Rate limiter must run early — before auth — so anonymous floods are blocked too.
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "SparkLoop API v1"));
}

app.UseCors("AllowFrontend");
app.UseStaticFiles();

app.UseMiddleware<RTLContextMiddleware>();

app.UseAuthentication();
app.UseAuthorization();

// Prometheus scrape endpoint (no auth — restrict at the network/edge layer).
app.MapPrometheusScrapingEndpoint("/metrics");

app.MapControllers();

// Health Check Endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    service = "SparkLoop.Api",
    environment = app.Environment.EnvironmentName,
    timestamp = DateTime.UtcNow
}));

// Initialize Database & Seed Demo Personas/Challenges
await DbInitializer.InitializeAsync(app.Services);

app.Run();
