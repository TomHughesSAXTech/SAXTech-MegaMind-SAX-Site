using System;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using System.Net;
using System.Text.Json;
using System.IO;

namespace SAXMegaMindDocuments
{
    public class GenerateSASToken
    {
        private readonly ILogger<GenerateSASToken> _logger;

        public GenerateSASToken(ILogger<GenerateSASToken> logger)
        {
            _logger = logger;
        }

        [Function("GenerateSASToken")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "GenerateSASToken")] HttpRequestData req)
        {
            _logger.LogInformation("Generate SAS Token function triggered");

            try
            {
                SASTokenRequest data = null;
                
                // Check if this is GET or POST
                if (req.Method.ToUpper() == "GET")
                {
                    // Parse from query string
                    var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                    data = new SASTokenRequest
                    {
                        FileName = query["fileName"],
                        Department = query["department"],
                        ContainerName = query["containerName"],
                        BlobPath = query["blobPath"],
                        ExpiryMinutes = int.TryParse(query["expiryMinutes"], out var exp) ? exp : 60
                    };
                }
                else
                {
                    // Read request body
                    string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                    data = JsonSerializer.Deserialize<SASTokenRequest>(requestBody, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }

                // Azure Storage configuration
                string accountName = Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT") ?? "saxtechmegamind";
                string accountKey = Environment.GetEnvironmentVariable("AZURE_STORAGE_KEY");
                string containerName = data?.ContainerName ?? "saxdocuments";

                if (string.IsNullOrEmpty(accountKey))
                {
                    _logger.LogError("Azure Storage key not configured");
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteAsJsonAsync(new { error = "Storage configuration error" });
                    return errorResponse;
                }

                // Construct blob path
                string blobPath;
                if (!string.IsNullOrEmpty(data?.BlobPath))
                {
                    // Direct blob path provided
                    blobPath = data.BlobPath;
                }
                else if (!string.IsNullOrEmpty(data?.FileName))
                {
                    // Construct from department and filename (fixing the path - no original-documents prefix)
                    blobPath = !string.IsNullOrEmpty(data.Department)
                        ? $"{data.Department}/{data.FileName}"
                        : data.FileName;
                }
                else
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteAsJsonAsync(new { error = "fileName or blobPath is required" });
                    return badResponse;
                }

                // Create BlobServiceClient
                string connectionString = $"DefaultEndpointsProtocol=https;AccountName={accountName};AccountKey={accountKey};EndpointSuffix=core.windows.net";
                BlobServiceClient blobServiceClient = new BlobServiceClient(connectionString);
                
                // Get container and blob clients
                BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                BlobClient blobClient = containerClient.GetBlobClient(blobPath);

                // Generate SAS token
                if (blobClient.CanGenerateSasUri)
                {
                    BlobSasBuilder sasBuilder = new BlobSasBuilder()
                    {
                        BlobContainerName = containerName,
                        BlobName = blobPath,
                        Resource = "b",
                        StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5),
                        ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(data.ExpiryMinutes ?? 60)
                    };

                    // Set read-only permissions for security
                    sasBuilder.SetPermissions(BlobSasPermissions.Read);

                    Uri sasUri = blobClient.GenerateSasUri(sasBuilder);

                    var response = req.CreateResponse(HttpStatusCode.OK);
                    await response.WriteAsJsonAsync(new
                    {
                        sasToken = sasUri.Query.TrimStart('?'),
                        blobUrl = sasUri.ToString(),
                        expiresOn = sasBuilder.ExpiresOn,
                        path = blobPath
                    });
                    return response;
                }
                else
                {
                    _logger.LogError("Cannot generate SAS token with current credentials");
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteAsJsonAsync(new { error = "Cannot generate SAS token" });
                    return errorResponse;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating SAS token");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = "Failed to generate SAS token", details = ex.Message });
                return errorResponse;
            }
        }

        private class SASTokenRequest
        {
            public string FileName { get; set; }
            public string Department { get; set; }
            public string ContainerName { get; set; }
            public string BlobPath { get; set; }
            public string Permissions { get; set; }
            public int? ExpiryMinutes { get; set; }
        }
    }
}
