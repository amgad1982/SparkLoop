namespace SparkLoop.Infrastructure.Security.OAuth;

public class OAuthSettings
{
    public const string SectionName = "Authentication:OAuth";

    public OAuthProviderConfig Google { get; set; } = new();
    public OAuthProviderConfig Facebook { get; set; } = new();
    public OAuthProviderConfig Twitter { get; set; } = new();
    public bool AllowDevFallback { get; set; } = true;
}

public class OAuthProviderConfig
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string AppId { get; set; } = string.Empty;
    public string AppSecret { get; set; } = string.Empty;
    public string AuthorizationEndpoint { get; set; } = string.Empty;
    public string TokenEndpoint { get; set; } = string.Empty;
    public string UserInfoEndpoint { get; set; } = string.Empty;
    public List<string> Scopes { get; set; } = new();

    public string EffectiveClientId => !string.IsNullOrWhiteSpace(ClientId) ? ClientId : AppId;
    public string EffectiveClientSecret => !string.IsNullOrWhiteSpace(ClientSecret) ? ClientSecret : AppSecret;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(EffectiveClientId) &&
                                !EffectiveClientId.StartsWith("YOUR_") &&
                                !string.IsNullOrWhiteSpace(EffectiveClientSecret) &&
                                !EffectiveClientSecret.StartsWith("YOUR_");
}

