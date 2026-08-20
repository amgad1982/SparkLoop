using SparkLoop.Api.Middlewares;
using SparkLoop.Api.Persistence;
using SparkLoop.Application;
using SparkLoop.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// 1. Add Application & Infrastructure Services
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);

// 2. Add Controllers & JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// 3. Configure CORS for React Vite Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()
            .SetIsOriginAllowed(_ => true);
    });
});

// 4. Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new Microsoft.OpenApi.OpenApiInfo
    {
        Title = "SparkLoop API",
        Version = "v1",
        Description = "Domain-Driven Design (DDD) & CQRS Backend for SparkLoop social micro-blogging and interactive entertainment platform."
    });
});

var app = builder.Build();

// 5. Configure Middleware Pipeline
app.UseMiddleware<GlobalExceptionHandlingMiddleware>();
app.UseMiddleware<RTLContextMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "SparkLoop API v1"));
}

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health Check Endpoint
app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    service = "SparkLoop.Api",
    timestamp = DateTime.UtcNow
}));

// Initialize Database & Seed Demo Personas/Challenges
await DbInitializer.InitializeAsync(app.Services);

app.Run();
