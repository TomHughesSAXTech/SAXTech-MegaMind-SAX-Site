using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using System.Net;
using System.Text.Json;
using Newtonsoft.Json;

namespace SAXMegaMindDocuments
{
    public class DeleteDocument
    {
        private readonly ILogger<DeleteDocument> _logger;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly SearchClient _searchClient;

        public DeleteDocument(
            ILogger<DeleteDocument> logger,
            BlobServiceClient blobServiceClient,
            SearchClient searchClient)
        {
            _logger = logger;
            _blobServiceClient = blobServiceClient;
            _searchClient = searchClient;
        }

        [Function("documents-delete")]
        public async Task<HttpResponseData> Delete(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "documents/delete/{documentId}")] HttpRequestData req,
            string documentId)
        {
            _logger.LogInformation($"Processing delete request for document: {documentId}");

            try
            {
                // First, get the document from search index to find blob URL
                dynamic document;
                try
                {
                    var searchResponse = await _searchClient.GetDocumentAsync<dynamic>(documentId);
                    document = searchResponse.Value;
                }
                catch (Azure.RequestFailedException ex) when (ex.Status == 404)
                {
                    var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                    await notFoundResponse.WriteStringAsync($"Document {documentId} not found in index");
                    return notFoundResponse;
                }
                
                // Handle JsonElement properly
                string blobUrl = null;
                string fileName = null;
                string department = null;
                
                if (document is System.Text.Json.JsonElement jsonElement)
                {
                    if (jsonElement.TryGetProperty("blobUrl", out var blobUrlProp))
                        blobUrl = blobUrlProp.GetString();
                    if (jsonElement.TryGetProperty("fileName", out var fileNameProp))
                        fileName = fileNameProp.GetString();
                    if (jsonElement.TryGetProperty("department", out var departmentProp))
                        department = departmentProp.GetString();
                }
                else if (document != null)
                {
                    // Fallback for other types
                    blobUrl = document.blobUrl?.ToString();
                    fileName = document.fileName?.ToString();
                    department = document.department?.ToString();
                }
                
                // Delete from blob storage
                bool blobDeleted = false;
                if (!string.IsNullOrEmpty(blobUrl))
                {
                    try
                    {
                        var uri = new Uri(blobUrl);
                        var containerName = uri.Segments[1].TrimEnd('/');
                        var blobName = string.Join("", uri.Segments.Skip(2));
                        
                        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                        var blobClient = containerClient.GetBlobClient(blobName);
                        
                        var deleteResponse = await blobClient.DeleteIfExistsAsync();
                        blobDeleted = deleteResponse.Value;
                        
                        if (deleteResponse.Value)
                        {
                            _logger.LogInformation($"Blob deleted successfully: {blobUrl}");
                        }
                        else
                        {
                            _logger.LogWarning($"Blob not found or already deleted: {blobUrl}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Error deleting blob: {ex.Message}");
                        // Continue with index deletion even if blob deletion fails
                    }
                }
                else if (!string.IsNullOrEmpty(fileName) && !string.IsNullOrEmpty(department))
                {
                    // If blobUrl is missing, try to construct the path from department and fileName
                    try
                    {
                        var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                        var blobPath = $"{department}/{fileName}";
                        var blobClient = containerClient.GetBlobClient(blobPath);
                        
                        var deleteResponse = await blobClient.DeleteIfExistsAsync();
                        blobDeleted = deleteResponse.Value;
                        
                        if (deleteResponse.Value)
                        {
                            _logger.LogInformation($"Blob deleted successfully using reconstructed path: {blobPath}");
                        }
                        else
                        {
                            _logger.LogWarning($"Blob not found at reconstructed path: {blobPath}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Error deleting blob with reconstructed path: {ex.Message}");
                    }
                }

                // Delete from search index
                var batch = IndexDocumentsBatch.Delete("id", new[] { documentId });
                var indexResult = await _searchClient.IndexDocumentsAsync(batch);

                if (indexResult.Value.Results.First().Succeeded)
                {
                    _logger.LogInformation($"Document deleted from index successfully: {documentId}");
                }
                else
                {
                    _logger.LogError($"Failed to delete document from index: {indexResult.Value.Results.First().ErrorMessage}");
                    
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync($"Failed to delete document from index");
                    return errorResponse;
                }

                // Return success response
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    documentId = documentId,
                    message = "Document deleted successfully"
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting document: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Error deleting document: {ex.Message}");
                return errorResponse;
            }
        }

        [Function("documents-delete-batch")]
        public async Task<HttpResponseData> DeleteBatch(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "documents/delete")] HttpRequestData req)
        {
            _logger.LogInformation("Processing batch delete request");

            try
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                _logger.LogInformation($"Received request body: {requestBody}");
                
                var deleteRequest = JsonConvert.DeserializeObject<BatchDeleteRequest>(requestBody);

                if (deleteRequest?.DocumentIds == null || !deleteRequest.DocumentIds.Any())
                {
                    _logger.LogWarning("No document IDs provided in request");
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteStringAsync("No document IDs provided");
                    return badResponse;
                }
                
                _logger.LogInformation($"Processing deletion for {deleteRequest.DocumentIds.Count} documents: {string.Join(", ", deleteRequest.DocumentIds)}");

                var results = new List<DeleteResult>();

                foreach (var documentId in deleteRequest.DocumentIds)
                {
                    try
                    {
                        // Get document from search index
                        _logger.LogInformation($"Checking if document {documentId} exists in search index");
                        
                        bool documentFound = false;
                        dynamic document = null;
                        
                        try
                        {
                            var searchResponse = await _searchClient.GetDocumentAsync<dynamic>(documentId);
                            // Successfully retrieved document - no need to check for null with System.Text.Json
                            document = searchResponse.Value;
                            documentFound = true;
                            _logger.LogInformation($"Document {documentId} found in search index");
                        }
                        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
                        {
                            _logger.LogInformation($"Document {documentId} not found in search index (404)");
                            documentFound = false;
                        }
                        
                        if (documentFound)
                        {
                            // Handle JsonElement properly
                            string blobUrl = null;
                            string fileName = null;
                            string department = null;
                            
                            if (document is System.Text.Json.JsonElement jsonElement)
                            {
                                if (jsonElement.TryGetProperty("blobUrl", out var blobUrlProp))
                                    blobUrl = blobUrlProp.GetString();
                                if (jsonElement.TryGetProperty("fileName", out var fileNameProp))
                                    fileName = fileNameProp.GetString();
                                if (jsonElement.TryGetProperty("department", out var departmentProp))
                                    department = departmentProp.GetString();
                            }
                            else if (document != null)
                            {
                                // Fallback for other types
                                blobUrl = document.blobUrl?.ToString();
                                fileName = document.fileName?.ToString();
                                department = document.department?.ToString();
                            }
                            
                            // Delete from blob storage
                            if (!string.IsNullOrEmpty(blobUrl))
                            {
                                try
                                {
                                    var uri = new Uri(blobUrl);
                                    var containerName = uri.Segments[1].TrimEnd('/');
                                    var blobName = string.Join("", uri.Segments.Skip(2));
                                    
                                    var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                                    var blobClient = containerClient.GetBlobClient(blobName);
                                    
                                    await blobClient.DeleteIfExistsAsync();
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning($"Failed to delete blob for document {documentId}: {ex.Message}");
                                }
                            }
                            else if (!string.IsNullOrEmpty(fileName) && !string.IsNullOrEmpty(department))
                            {
                                // If blobUrl is missing, try to construct the path from department and fileName
                                try
                                {
                                    var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                                    var blobPath = $"{department}/{fileName}";
                                    var blobClient = containerClient.GetBlobClient(blobPath);
                                    
                                    await blobClient.DeleteIfExistsAsync();
                                    _logger.LogInformation($"Deleted blob using reconstructed path: {blobPath}");
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning($"Failed to delete blob with reconstructed path for document {documentId}: {ex.Message}");
                                }
                            }

                            // Delete from search index
                            _logger.LogInformation($"Attempting to delete document {documentId} from search index");
                            var batch = IndexDocumentsBatch.Delete("id", new[] { documentId });
                            var indexResult = await _searchClient.IndexDocumentsAsync(batch);
                            
                            var deleteSucceeded = indexResult.Value.Results.First().Succeeded;
                            var errorMessage = indexResult.Value.Results.First().ErrorMessage;
                            
                            if (deleteSucceeded)
                            {
                                _logger.LogInformation($"Successfully deleted document {documentId} from search index");
                            }
                            else
                            {
                                _logger.LogError($"Failed to delete document {documentId} from search index: {errorMessage}");
                            }

                            results.Add(new DeleteResult
                            {
                                DocumentId = documentId,
                                Success = deleteSucceeded,
                                Message = deleteSucceeded 
                                    ? "Deleted successfully" 
                                    : errorMessage
                            });
                        }
                        else
                        {
                            results.Add(new DeleteResult
                            {
                                DocumentId = documentId,
                                Success = false,
                                Message = "Document not found"
                            });
                        }
                    }
                    catch (Exception ex)
                    {
                        results.Add(new DeleteResult
                        {
                            DocumentId = documentId,
                            Success = false,
                            Message = ex.Message
                        });
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = results.All(r => r.Success),
                    totalRequested = deleteRequest.DocumentIds.Count,
                    totalDeleted = results.Count(r => r.Success),
                    results = results
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in batch delete: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Error processing batch delete: {ex.Message}");
                return errorResponse;
            }
        }
    }

    public class BatchDeleteRequest
    {
        public List<string> DocumentIds { get; set; }
    }

    public class DeleteResult
    {
        public string DocumentId { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; }
    }
}
