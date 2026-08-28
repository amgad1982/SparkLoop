# ==========================================
# Multi-stage Dockerfile for SparkLoop Backend
# Framework: .NET 10 Web API
# ==========================================

# Stage 1: Base ASP.NET 10 Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS base
WORKDIR /app
EXPOSE 5000
ENV ASPNETCORE_URLS=http://+:5000 \
    DOTNET_RUNNING_IN_CONTAINER=true

# Stage 2: SDK Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Copy project files for efficient Docker layer caching
COPY ["backend/src/SparkLoop.Api/SparkLoop.Api.csproj", "backend/src/SparkLoop.Api/"]
COPY ["backend/src/SparkLoop.Application/SparkLoop.Application.csproj", "backend/src/SparkLoop.Application/"]
COPY ["backend/src/SparkLoop.Domain/SparkLoop.Domain.csproj", "backend/src/SparkLoop.Domain/"]
COPY ["backend/src/SparkLoop.Infrastructure/SparkLoop.Infrastructure.csproj", "backend/src/SparkLoop.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "backend/src/SparkLoop.Api/SparkLoop.Api.csproj"

# Copy entire backend source
COPY backend/ backend/

# Build and Publish
WORKDIR "/src/backend/src/SparkLoop.Api"
RUN dotnet publish "SparkLoop.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 3: Production Runtime
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

# Create uploads directory and non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    mkdir -p /app/wwwroot/uploads && \
    chown -R appuser:appgroup /app

USER appuser

ENTRYPOINT ["dotnet", "SparkLoop.Api.dll"]
