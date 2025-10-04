using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.Search.Documents.Indexes;
using Azure.Search.Documents.Indexes.Models;
using System.Net;
using Newtonsoft.Json;
using Azure;

namespace SAXMegaMindDocuments
{
    public class IndexMaintenance
    {
        private readonly ILogger<IndexMaintenance> _logger;
        private readonly SearchClient _searchClient;
        private readonly SearchIndexClient _indexClient;
        private readonly BlobServiceClient _blobServiceClient;

        public IndexMaintenance(
            ILogger<IndexMaintenance> logger,
            SearchClient searchClient,
            BlobServiceClient blobServiceClient)
        {
            _logger = logger;
            _searchClient = searchClient;
            _blobServiceClient = blobServiceClient;
            
            // Create index client from search client configuration
            var searchServiceEndpoint = Environment.GetEnvironmentVariable("AzureSearchServiceEndpoint");
            var searchApiKey = Environment.GetEnvironmentVariable("AzureSearchApiKey");
            
            if (!string.IsNullOrEmpty(searchServiceEndpoint) && !string.IsNullOrEmpty(searchApiKey))
            {
                _indexClient = new SearchIndexClient(new Uri(searchServiceEndpoint), new AzureKeyCredential(searchApiKey));
            }
        }

        [Function("index-maintenance")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "index/maintenance")] HttpRequestData req)
        {
            _logger.LogInformation("Index maintenance function triggered");

            try
            {
                // Parse request body
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var request = JsonConvert.DeserializeObject<MaintenanceRequest>(requestBody);

                if (request == null || string.IsNullOrEmpty(request.Operation))
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Operation is required"
                    });
                    return badResponse;
                }

                switch (request.Operation.ToLower())
                {
                    case "stats":
                        return await GetIndexStats(req);
                        
                    case "clear":
                        return await ClearIndex(req, request);
                        
                    case "reindex":
                        return await ReindexDocuments(req, request);
                        
                    case "delete-by-department":
                        return await DeleteByDepartment(req, request);
                        
                    case "list-departments":
                        return await ListDepartments(req);
                        
                    default:
                        var unknownResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                        await unknownResponse.WriteAsJsonAsync(new
                        {
                            success = false,
                            message = $"Unknown operation: {request.Operation}"
                        });
                        return unknownResponse;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in index maintenance: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new
                {
                    success = false,
                    message = $"Index maintenance failed: {ex.Message}"
                });
                return errorResponse;
            }
        }

        private async Task<HttpResponseData> GetIndexStats(HttpRequestData req)
        {
            try
            {
                // Get index statistics
                var searchResults = await _searchClient.SearchAsync<SearchDocument>("*",
                    new SearchOptions
                    {
                        IncludeTotalCount = true,
                        Size = 0
                    });

                // Get unique departments
                var facetResults = await _searchClient.SearchAsync<SearchDocument>("*",
                    new SearchOptions
                    {
                        Facets = { "department" },
                        Size = 0
                    });

                var departments = new Dictionary<string, long>();
                if (facetResults.Value.Facets.ContainsKey("department"))
                {
                    foreach (var facet in facetResults.Value.Facets["department"])
                    {
                        departments[facet.Value.ToString()] = facet.Count.GetValueOrDefault(0);
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    stats = new
                    {
                        totalDocuments = searchResults.Value.TotalCount,
                        indexName = "sop-documents",
                        departments = departments,
                        lastUpdated = DateTime.UtcNow
                    }
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting index stats: {ex.Message}");
                throw;
            }
        }

        private async Task<HttpResponseData> ClearIndex(HttpRequestData req, MaintenanceRequest request)
        {
            try
            {
                if (!request.Confirm)
                {
                    var confirmResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await confirmResponse.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Please confirm this operation by setting 'confirm' to true"
                    });
                    return confirmResponse;
                }

                // Get all document IDs
                var searchResults = await _searchClient.SearchAsync<SearchDocument>("*",
                    new SearchOptions
                    {
                        Select = { "id" },
                        Size = 1000
                    });

                var documentIds = new List<string>();
                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    if (result.Document.TryGetValue("id", out var id))
                    {
                        documentIds.Add(id.ToString());
                    }
                }

                // Delete in batches
                int deleted = 0;
                int batchSize = 100;
                
                for (int i = 0; i < documentIds.Count; i += batchSize)
                {
                    var batch = documentIds.Skip(i).Take(batchSize).ToArray();
                    var deleteBatch = IndexDocumentsBatch.Delete("id", batch);
                    await _searchClient.IndexDocumentsAsync(deleteBatch);
                    deleted += batch.Length;
                    _logger.LogInformation($"Deleted batch of {batch.Length} documents");
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = $"Successfully cleared {deleted} documents from index"
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error clearing index: {ex.Message}");
                throw;
            }
        }

        private async Task<HttpResponseData> ReindexDocuments(HttpRequestData req, MaintenanceRequest request)
        {
            try
            {
                // This would require triggering a re-processing of all documents
                // For now, return a message about manual reprocessing
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Reindexing requires re-uploading documents through the n8n workflow. " +
                             "Please trigger the n8n workflow to reprocess all documents in blob storage."
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error reindexing: {ex.Message}");
                throw;
            }
        }

        private async Task<HttpResponseData> DeleteByDepartment(HttpRequestData req, MaintenanceRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Department))
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteAsJsonAsync(new
                    {
                        success = false,
                        message = "Department is required for this operation"
                    });
                    return badResponse;
                }

                // Search for documents in the specified department
                var searchResults = await _searchClient.SearchAsync<SearchDocument>("*",
                    new SearchOptions
                    {
                        Filter = $"department eq '{request.Department}'",
                        Select = { "id" },
                        Size = 1000
                    });

                var documentIds = new List<string>();
                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    if (result.Document.TryGetValue("id", out var id))
                    {
                        documentIds.Add(id.ToString());
                    }
                }

                if (documentIds.Count == 0)
                {
                    var noDocsResponse = req.CreateResponse(HttpStatusCode.OK);
                    await noDocsResponse.WriteAsJsonAsync(new
                    {
                        success = true,
                        message = $"No documents found for department: {request.Department}"
                    });
                    return noDocsResponse;
                }

                // Delete the documents
                var deleteBatch = IndexDocumentsBatch.Delete("id", documentIds.ToArray());
                await _searchClient.IndexDocumentsAsync(deleteBatch);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = $"Successfully deleted {documentIds.Count} documents from department: {request.Department}"
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting by department: {ex.Message}");
                throw;
            }
        }

        private async Task<HttpResponseData> ListDepartments(HttpRequestData req)
        {
            try
            {
                // Get departments from blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                var departments = new HashSet<string>();

                await foreach (var blobItem in containerClient.GetBlobsAsync())
                {
                    // Extract department from blob path
                    var parts = blobItem.Name.Split('/');
                    if (parts.Length > 0)
                    {
                        departments.Add(parts[0]);
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    departments = departments.OrderBy(d => d).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error listing departments: {ex.Message}");
                throw;
            }
        }

        public class MaintenanceRequest
        {
            public string Operation { get; set; }
            public string Department { get; set; }
            public bool Confirm { get; set; }
            public Dictionary<string, object> Options { get; set; }
        }
    }
}
