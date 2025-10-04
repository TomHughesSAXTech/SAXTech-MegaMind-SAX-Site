using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using System.Net;
using System.Collections.Generic;

namespace SAXMegaMindDocuments
{
    public class DeleteBlobFunction
    {
        private readonly ILogger<DeleteBlobFunction> _logger;

        public DeleteBlobFunction(ILogger<DeleteBlobFunction> logger)
        {
            _logger = logger;
        }

        [Function("DeleteBlob")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", "delete", Route = null)] HttpRequestData req)
        {
            _logger.LogInformation("DeleteBlob function triggered");

            try
            {
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var request = JsonConvert.DeserializeObject<DeleteBlobRequest>(requestBody);

                if (string.IsNullOrEmpty(request?.FileName) || string.IsNullOrEmpty(request?.Department))
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteStringAsync("FileName and Department are required");
                    return badResponse;
                }

                // Get storage connection string
                string storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
                if (string.IsNullOrEmpty(storageConnectionString))
                {
                    _logger.LogError("Storage connection string not configured");
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync("Storage connection string not configured");
                    return errorResponse;
                }

                // Create blob service client
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerName = request.ContainerName ?? "saxdocuments";
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);

                bool deleted = false;
                var deletedPaths = new List<string>();

                // Try to delete from original-documents
                string originalPath = $"original-documents/{request.Department}/{request.FileName}";
                var originalBlobClient = containerClient.GetBlobClient(originalPath);
                
                try
                {
                    var deleteResponse = await originalBlobClient.DeleteIfExistsAsync();
                    if (deleteResponse.Value)
                    {
                        deleted = true;
                        deletedPaths.Add(originalPath);
                        _logger.LogInformation($"Deleted blob from original-documents: {originalPath}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Could not delete from original-documents: {ex.Message}");
                }

                // Try to delete from converted-documents
                string convertedPath = $"converted-documents/{request.Department}/{request.FileName}";
                var convertedBlobClient = containerClient.GetBlobClient(convertedPath);
                
                try
                {
                    var deleteResponse = await convertedBlobClient.DeleteIfExistsAsync();
                    if (deleteResponse.Value)
                    {
                        deleted = true;
                        deletedPaths.Add(convertedPath);
                        _logger.LogInformation($"Deleted blob from converted-documents: {convertedPath}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Could not delete from converted-documents: {ex.Message}");
                }

                // If a direct blob URL was provided, try to delete it
                if (!string.IsNullOrEmpty(request.BlobUrl))
                {
                    try
                    {
                        Uri blobUri = new Uri(request.BlobUrl);
                        
                        // Use connection string if it's the same storage account
                        if (blobUri.Host.Contains("saxmegamind"))
                        {
                            string blobName = blobUri.AbsolutePath.TrimStart('/');
                            if (blobName.StartsWith(containerName + "/"))
                            {
                                blobName = blobName.Substring((containerName + "/").Length);
                            }
                            
                            var directClient = containerClient.GetBlobClient(blobName);
                            var deleteResponse = await directClient.DeleteIfExistsAsync();
                            if (deleteResponse.Value)
                            {
                                deleted = true;
                                deletedPaths.Add(blobName);
                                _logger.LogInformation($"Deleted blob from direct URL: {blobName}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Could not delete from direct URL: {ex.Message}");
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                
                if (deleted)
                {
                    await response.WriteAsJsonAsync(new
                    {
                        success = true,
                        message = "Blob(s) deleted successfully",
                        deletedPaths = deletedPaths
                    });
                }
                else
                {
                    _logger.LogWarning($"No blobs found to delete for: {request.FileName} in {request.Department}");
                    await response.WriteAsJsonAsync(new
                    {
                        success = true,
                        message = "No blobs found to delete (may have been already deleted)",
                        deletedPaths = new string[0]
                    });
                }
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting blob");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Error: {ex.Message}");
                return errorResponse;
            }
        }
    }

    public class DeleteBlobRequest
    {
        public string FileName { get; set; }
        public string Department { get; set; }
        public string ContainerName { get; set; }
        public string BlobUrl { get; set; }
    }
}