using Npgsql;

namespace SparkLoop.Infrastructure.BackgroundJobs;

/// <summary>
/// Helpers for acquiring a PostgreSQL session-level advisory lock so that
/// exactly one API replica runs a given background job at a time.
///
/// Without this guard each replica would independently try to deactivate
/// expired Mood Pods etc. — wasting DB writes and potentially emitting
/// duplicate Centrifugo broadcasts. With this guard the lock is held for
/// the duration of one tick of the worker's loop; other replicas immediately
/// bail out and try again on the next tick.
///
/// The lock is acquired on a dedicated, short-lived Npgsql connection so
/// the worker can run its own scoped DbContext inside the protected block
/// without the lock being released prematurely.
/// </summary>
public static class PostgresAdvisoryLock
{
    /// <summary>
    /// Try to acquire the session-level advisory lock with the given key.
    /// The caller MUST invoke <see cref="IAsyncDisposable.DisposeAsync"/>
    /// when the protected section is complete — that releases the lock and
    /// lets another replica pick up.
    /// </summary>
    public static async Task<LeaderLock?> TryAcquireAsync(
        string connectionString,
        long key,
        CancellationToken cancellationToken)
    {
        var conn = new NpgsqlConnection(connectionString);
        try
        {
            await conn.OpenAsync(cancellationToken);
            await using var command = conn.CreateCommand();
            command.CommandText = "SELECT pg_try_advisory_lock(@k)";
            var p = command.CreateParameter();
            p.ParameterName = "@k";
            p.Value = key;
            command.Parameters.Add(p);

            var result = await command.ExecuteScalarAsync(cancellationToken);
            if (result is not bool acquired || !acquired)
            {
                await conn.DisposeAsync();
                return null;
            }
            return new LeaderLock(conn);
        }
        catch
        {
            await conn.DisposeAsync();
            throw;
        }
    }
}

/// <summary>
/// Holds a session-level Postgres advisory lock for as long as the instance
/// is alive. Dispose to release.
/// </summary>
public sealed class LeaderLock : IAsyncDisposable
{
    private readonly NpgsqlConnection _conn;
    private bool _disposed;

    internal LeaderLock(NpgsqlConnection conn) => _conn = conn;

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;
        try
        {
            if (_conn.State == System.Data.ConnectionState.Open)
            {
                await using var command = _conn.CreateCommand();
                command.CommandText = "SELECT pg_advisory_unlock_all()";
                await command.ExecuteNonQueryAsync();
            }
        }
        catch
        {
            // best-effort — closing the connection also releases all
            // session-level advisory locks held by it.
        }
        finally
        {
            await _conn.DisposeAsync();
        }
    }
}