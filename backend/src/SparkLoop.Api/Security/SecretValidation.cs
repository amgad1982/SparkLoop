namespace SparkLoop.Api.Security;

/// <summary>
/// Validates that production deployments do not fall back to the public,
/// repository-checked-in default secrets.
///
/// Several services (Centrifugo, MinIO, LiveKit, JWT) historically shipped
/// hard-coded placeholder keys when the matching configuration entry was
/// missing. Those defaults were committed to the repository for local dev
/// convenience, but accepting them in production would mean anyone who reads
/// the repo could publish to Centrifugo, read/write the MinIO bucket, or sign
/// valid JWTs.
///
/// This helper is invoked from <c>Program.cs</c> at startup. In any
/// non-Development environment it refuses to start the API when any of the
/// "insecure default" values is still in use.
/// </summary>
public static class SecretValidation
{
    /// <summary>
    /// Default placeholder values that must never be present in production.
    /// </summary>
    public static readonly string[] InsecureSecretPatterns =
    {
        "sparkloop_centrifugo_api_key_2026_super_secure",
        "sparkloop_centrifugo_secret_jwt_key_2026_super_secure",
        "sparkloop_admin_secret_key_2026_super_secure",
        "sparkloop_admin_password_123",
        "sparkloop_livekit_secret_2026_super_secure_32chars",
        "minioadminpassword123!"
    };

    public static void EnsureProductionSecretsAreConfigured(IConfiguration config, IHostEnvironment env)
    {
        if (env.IsDevelopment())
        {
            return;
        }

        var problems = new List<string>();

        void Check(string sectionKey, string label)
        {
            var value = config[sectionKey];
            if (string.IsNullOrWhiteSpace(value))
            {
                problems.Add($"  • {label} ({sectionKey}) is missing");
                return;
            }

            foreach (var bad in InsecureSecretPatterns)
            {
                if (value.Contains(bad, StringComparison.OrdinalIgnoreCase))
                {
                    problems.Add($"  • {label} ({sectionKey}) still uses the in-repo placeholder default");
                    return;
                }
            }
        }

        Check("Centrifugo:ApiKey", "Centrifugo API key");
        Check("Centrifugo:SecretKey", "Centrifugo JWT secret");
        Check("LiveKit:ApiSecret", "LiveKit API secret");
        Check("Storage:SecretKey", "MinIO secret key");
        Check("JwtSettings:SecretKey", "JWT signing key");

        if (problems.Count > 0)
        {
            var banner = "================================================================\n"
                       + "  SparkLoop refused to start — insecure configuration detected\n"
                       + "================================================================\n";
            throw new InvalidOperationException(
                banner + "The following configuration values must be replaced with real secrets "
                + "before SparkLoop can run outside the Development environment:\n\n"
                + string.Join("\n", problems)
                + "\n\nSet the values via environment variables, user secrets, or your secrets manager.");
        }
    }
}
