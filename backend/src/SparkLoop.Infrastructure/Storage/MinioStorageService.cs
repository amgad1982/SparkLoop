using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SparkLoop.Application.Interfaces;

namespace SparkLoop.Infrastructure.Storage;

public class MinioStorageService : IBlobStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly string _publicBaseUrl;
    private readonly ILogger<MinioStorageService> _logger;
    private bool _bucketInitialized = false;

    public MinioStorageService(IConfiguration configuration, ILogger<MinioStorageService> logger)
    {
        _logger = logger;
        _bucketName = configuration["Storage:BucketName"] ?? "sparkloop-media";
        _publicBaseUrl = configuration["Storage:PublicUrl"] ?? "http://localhost:9000/sparkloop-media";

        var serviceUrl = configuration["Storage:ServiceUrl"] ?? "http://localhost:9000";
        var accessKey = configuration["Storage:AccessKey"] ?? "minioadmin";
        var secretKey = configuration["Storage:SecretKey"] ?? "minioadminpassword123!";

        var config = new AmazonS3Config
        {
            ServiceURL = serviceUrl,
            ForcePathStyle = true,
            UseHttp = true
        };

        _s3Client = new AmazonS3Client(accessKey, secretKey, config);
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (_bucketInitialized) return;

        try
        {
            var exists = await Amazon.S3.Util.AmazonS3Util.DoesS3BucketExistV2Async(_s3Client, _bucketName);
            if (!exists)
            {
                var putBucketRequest = new PutBucketRequest
                {
                    BucketName = _bucketName,
                    UseClientRegion = true
                };
                await _s3Client.PutBucketAsync(putBucketRequest, cancellationToken);

                // Set public read policy for media bucket
                var policy = $$"""
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "PublicRead",
                            "Effect": "Allow",
                            "Principal": "*",
                            "Action": ["s3:GetObject"],
                            "Resource": ["arn:aws:s3:::{{_bucketName}}/*"]
                        }
                    ]
                }
                """;

                await _s3Client.PutBucketPolicyAsync(new PutBucketPolicyRequest
                {
                    BucketName = _bucketName,
                    Policy = policy
                }, cancellationToken);
            }
            _bucketInitialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not initialize MinIO S3 bucket: {Message}. Storage will use direct fallback URLs.", ex.Message);
        }
    }

    public async Task<string> UploadFileAsync(Stream stream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        var sanitizedFileName = $"{Guid.NewGuid()}_{Path.GetFileName(fileName)}";

        try
        {
            await EnsureBucketExistsAsync(cancellationToken);

            var putRequest = new PutObjectRequest
            {
                BucketName = _bucketName,
                Key = sanitizedFileName,
                InputStream = stream,
                ContentType = contentType,
                AutoCloseStream = false
            };

            await _s3Client.PutObjectAsync(putRequest, cancellationToken);
            return $"{_publicBaseUrl.TrimEnd('/')}/{sanitizedFileName}";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "MinIO upload failed ({Message}). Returning local mock media URL.", ex.Message);
            return $"http://localhost:5000/media/{sanitizedFileName}";
        }
    }

    public async Task DeleteFileAsync(string fileUrl, CancellationToken cancellationToken = default)
    {
        try
        {
            var fileName = Path.GetFileName(new Uri(fileUrl).AbsolutePath);
            await _s3Client.DeleteObjectAsync(_bucketName, fileName, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete file from S3: {Url}", fileUrl);
        }
    }
}
