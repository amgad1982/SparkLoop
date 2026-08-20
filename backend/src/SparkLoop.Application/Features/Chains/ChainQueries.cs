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

    public GetActiveChainsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<ChainDto>> Handle(GetActiveChainsQuery request, CancellationToken cancellationToken)
    {
        var chains = await _dbContext.Chains
            .Include(c => c.Steps)
            .Where(c => c.Status == ChainStatus.Open)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return chains.Select(c => CreateChainCommandHandler.MapToDto(c, _currentUserService.UserId)).ToList();
    }
}

public record GetChainByIdQuery(Guid ChainId) : IRequest<ChainDto>;

public class GetChainByIdQueryHandler : IRequestHandler<GetChainByIdQuery, ChainDto>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetChainByIdQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<ChainDto> Handle(GetChainByIdQuery request, CancellationToken cancellationToken)
    {
        var chain = await _dbContext.Chains
            .Include(c => c.Steps)
            .FirstOrDefaultAsync(c => c.Id == request.ChainId, cancellationToken)
            ?? throw new NotFoundException("Chain", request.ChainId);

        return CreateChainCommandHandler.MapToDto(chain, _currentUserService.UserId);
    }
}

public record GetCompletedChainsQuery : IRequest<IReadOnlyList<ChainDto>>;

public class GetCompletedChainsQueryHandler : IRequestHandler<GetCompletedChainsQuery, IReadOnlyList<ChainDto>>
{
    private readonly IAppDbContext _dbContext;
    private readonly ICurrentUserService _currentUserService;

    public GetCompletedChainsQueryHandler(IAppDbContext dbContext, ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _currentUserService = currentUserService;
    }

    public async Task<IReadOnlyList<ChainDto>> Handle(GetCompletedChainsQuery request, CancellationToken cancellationToken)
    {
        var chains = await _dbContext.Chains
            .Include(c => c.Steps)
            .Where(c => c.Status == ChainStatus.Completed)
            .OrderByDescending(c => c.CompletedAtUtc ?? c.CreatedAtUtc)
            .Take(20)
            .ToListAsync(cancellationToken);

        return chains.Select(c => CreateChainCommandHandler.MapToDto(c, _currentUserService.UserId)).ToList();
    }
}
