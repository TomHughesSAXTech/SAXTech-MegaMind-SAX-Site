using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Azure.Storage;

namespace SAXTechMegaMind.Functions
{
    public static class GenerateSASToken
    {
        [FunctionName("GenerateSASToken")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "documents/generateSAS")] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("Generate SAS Token function triggered");

            try
            {
                // Read request body
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                dynamic data = JsonConvert.DeserializeObject(requestBody);

                // Get parameters
                string fileName = data?.fileName;
                string department = data?.department ?? "General";
                string containerName = data?.containerName ?? "saxdocuments";
                string permissions = data?.permissions ?? "r";
                int expiryMinutes = data?.expiryMinutes ?? 60;

                if (string.IsNullOrEmpty(fileName))
                {
                    return new BadRequestObjectResult(new { error = "fileName is required" });
                }

                // Azure Storage configuration
                string accountName = Environment.GetEnvironmentVariable("AZURE_STORAGE_ACCOUNT") ?? "saxtechmegamind";
                string accountKey = Environment.GetEnvironmentVariable("AZURE_STORAGE_KEY");

                if (string.IsNullOrEmpty(accountKey))
                {
                    log.LogError("Azure Storage key not configured");
                    return new StatusCodeResult(500);
                }

                // Construct blob path
                string blobPath = !string.IsNullOrEmpty(department) 
                    ? $"original-documents/{department.ToLower()}/{fileName}"
                    : $"original-documents/{fileName}";

                // Create a BlobServiceClient
                string connectionString = $"DefaultEndpointsProtocol=https;AccountName={accountName};AccountKey={accountKey};EndpointSuffix=core.windows.net";
                BlobServiceClient blobServiceClient = new BlobServiceClient(connectionString);
                
                // Get container client
                BlobContainerClient containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                
                // Get blob client
                BlobClient blobClient = containerClient.GetBlobClient(blobPath);

                // Check if we can generate SAS tokens
                if (blobClient.CanGenerateSasUri)
                {
                    // Create SAS token
                    BlobSasBuilder sasBuilder = new BlobSasBuilder()
                    {
                        BlobContainerName = containerName,
                        BlobName = blobPath,
                        Resource = "b", // b for blob
                        StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5), // Account for clock skew
                        ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes)
                    };

                    // Set permissions (read-only for security)
                    sasBuilder.SetPermissions(BlobSasPermissions.Read);

                    // Generate the SAS URI
                    Uri sasUri = blobClient.GenerateSasUri(sasBuilder);

                    // Return the SAS token and full URL
                    return new OkObjectResult(new
                    {
                        sasToken = sasUri.Query.TrimStart('?'),
                        blobUrl = sasUri.ToString(),
                        expiresOn = sasBuilder.ExpiresOn,
                        path = blobPath
                    });
                }
                else
                {
                    log.LogError("Cannot generate SAS token with current credentials");
                    return new StatusCodeResult(500);
                }
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error generating SAS token");
                return new StatusCodeResult(500);
            }
        }
    }
}
