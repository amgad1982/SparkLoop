using MediatR;
using Microsoft.EntityFrameworkCore;
using SparkLoop.Application.DTOs;
using SparkLoop.Application.Interfaces;
using SparkLoop.Domain.Aggregates.ChainAggregate;
using SparkLoop.Domain.Exceptions;

namespace SparkLoop.Application.Features.Chains;

public record GetActiveChainsQuery : IRequest<IReadOnlyList<ChainDto>>;

public class GetActiveChainsQueryHandler : IRequestHandler<GetActiveChainsQuery, IReadOnlyList<ChainDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICacheService _cacheService;

    public GetActiveChainsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICacheService cacheService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _cacheService = cacheService;
    }

    public async Task<IReadOnlyList<ChainDto>> Handle(GetActiveChainsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var cacheKey = currentUserId.HasValue
            ? $"chains:active:user:{currentUserId.Value}"
            : "chains:active:anon";

        return await _cacheService.GetOrSetAsync<IReadOnlyList<ChainDto>>(
            cacheKey,
            async ct =>
            {
                var chains = await _dbContext.Chains
                    .Include(c => c.Steps)
                    .Where(c => c.Status == ChainStatus.Open)
                    .OrderByDescending(c => c.CreatedAtUtc)
                    .ToListAsync(ct);

                return chains.Select(c => CreateChainCommandHandler.MapToDto(c, currentUserId)).ToList();
            },
            duration: TimeSpan.FromSeconds(30),
            failSafeMaxDuration: TimeSpan.FromMinutes(5),
            cancellationToken: cancellationToken
        );
    }
}

public record GetChainByIdQuery(Guid ChainId) : IRequest<ChainDto>;

public class GetChainByIdQueryHandler : IRequestHandler<GetChainByIdQuery, ChainDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICacheService _cacheService;

    public GetChainByIdQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICacheService cacheService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _cacheService = cacheService;
    }

    public async Task<ChainDto> Handle(GetChainByIdQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var cacheKey = currentUserId.HasValue
            ? $"chains:id:{request.ChainId}:user:{currentUserId.Value}"
            : $"chains:id:{request.ChainId}:anon";

        return await _cacheService.GetOrSetAsync<ChainDto>(
            cacheKey,
            async ct =>
            {
                var chain = await _dbContext.Chains
                    .Include(c => c.Steps)
                    .FirstOrDefaultAsync(c => c.Id == request.ChainId, ct)
                    ?? throw new NotFoundException("Chain", request.ChainId);

                return CreateChainCommandHandler.MapToDto(chain, currentUserId);
            },
            duration: TimeSpan.FromMinutes(1),
            failSafeMaxDuration: TimeSpan.FromMinutes(10),
            cancellationToken: cancellationToken
        );
    }
}

public record GetCompletedChainsQuery : IRequest<IReadOnlyList<ChainDto>>;

public class GetCompletedChainsQueryHandler : IRequestHandler<GetCompletedChainsQuery, IReadOnlyList<ChainDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;
    private readonly ICacheService _cacheService;

    public GetCompletedChainsQueryHandler(
        IAppDbContext dbContext,
        ICurrentUserService currentUserService,
        ICacheService cacheService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
        _cacheService = cacheService;
    }

    public async Task<IReadOnlyList<ChainDto>> Handle(GetCompletedChainsQuery request, CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var cacheKey = currentUserId.HasValue
            ? $"chains:completed:user:{currentUserId.Value}"
            : "chains:completed:anon";

        return await _cacheService.GetOrSetAsync<IReadOnlyList<ChainDto>>(
            cacheKey,
            async ct =>
            {
                var chains = await _dbContext.Chains
                    .Include(c => c.Steps)
                    .Where(c => c.Status == ChainStatus.Completed)
                    .OrderByDescending(c => c.CompletedAtUtc ?? c.CreatedAtUtc)
                    .Take(20)
                    .ToListAsync(ct);

                return chains.Select(c => CreateChainCommandHandler.MapToDto(c, currentUserId)).ToList();
            },
            duration: TimeSpan.FromMinutes(30),
            failSafeMaxDuration: TimeSpan.FromHours(24),
            cancellationToken: cancellationToken
        );
    }
}
