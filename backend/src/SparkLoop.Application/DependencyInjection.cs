using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using SparkLoop.Application.Behaviors;
using SparkLoop.Application.Features.MoodPods;

namespace SparkLoop.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        // Single in-memory store for the latest BG-music state per pod.
        // Used by SendPodBgMusicCommandHandler to persist the active track so
        // late joiners can fetch it on entry; see PodBgMusicStateStore.cs.
        services.AddSingleton<PodBgMusicStateStore>();

        return services;
    }
}
