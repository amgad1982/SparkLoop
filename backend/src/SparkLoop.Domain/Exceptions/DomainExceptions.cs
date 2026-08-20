namespace SparkLoop.Domain.Exceptions;

public class DomainRuleException : Exception
{
    public string Code { get; }

    public DomainRuleException(string message, string code = "DOMAIN_RULE_VIOLATION") : base(message)
    {
        Code = code;
    }
}

public class ConcurrencyException : Exception
{
    public ConcurrencyException(string message = "The entity has been modified concurrently by another process. Please refresh and try again.")
        : base(message)
    {
    }
}

public class NotFoundException : Exception
{
    public NotFoundException(string entityName, object key)
        : base($"Entity '{entityName}' with key '{key}' was not found.")
    {
    }

    public NotFoundException(string message) : base(message)
    {
    }
}

public class UnauthorizedDomainException : Exception
{
    public UnauthorizedDomainException(string message = "User is not authorized to perform this domain action.")
        : base(message)
    {
    }
}
