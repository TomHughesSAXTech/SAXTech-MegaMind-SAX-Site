using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using System.Net;
using System.Text.Json;
using Newtonsoft.Json;
using Azure.AI.OpenAI;

namespace SAXMegaMindDocuments
{
    public class DocumentSearchEnhanced
    {
        private readonly ILogger<DocumentSearchEnhanced> _logger;
        private readonly SearchClient _searchClient;
        private readonly OpenAIClient _openAIClient;

        public DocumentSearchEnhanced(ILogger<DocumentSearchEnhanced> logger, SearchClient searchClient, OpenAIClient openAIClient)
        {
            _logger = logger;
            _searchClient = searchClient;
            _openAIClient = openAIClient;
        }

        [Function("documents-search-enhanced")]
        public async Task<HttpResponseData> EnhancedSearch(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "documents/search-enhanced")] HttpRequestData req)
        {
            _logger.LogInformation("Processing enhanced search request");

            try
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                _logger.LogInformation($"Enhanced search request body: {requestBody}");

                var searchRequest = JsonConvert.DeserializeObject<EnhancedSearchRequest>(requestBody);
                
                if (searchRequest?.Search == null)
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteStringAsync("Search query is required");
                    return badResponse;
                }

                // Generate embeddings for semantic search
                float[]? queryEmbeddings = null;
                if (searchRequest.UseSemanticSearch ?? true)
                {
                    try
                    {
                        var embeddingResponse = await _openAIClient.GetEmbeddingsAsync(
                            new EmbeddingsOptions("text-embedding-3-large", new[] { searchRequest.Search })
                        );
                        queryEmbeddings = embeddingResponse.Value.Data[0].Embedding.ToArray();
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Failed to generate query embeddings: {ex.Message}");
                    }
                }

                // Enhanced search options with hybrid search
                var searchOptions = new SearchOptions
                {
                    IncludeTotalCount = true,
                    Size = searchRequest.Top ?? 50,
                    Skip = searchRequest.Skip ?? 0,
                    QueryType = SearchQueryType.Full
                };
                
                // Add vector search if embeddings are available
                if (queryEmbeddings != null)
                {
                    searchOptions.VectorSearch = new()
                    {
                        Queries = {
                            new VectorizedQuery(queryEmbeddings)
                            {
                                KNearestNeighborsCount = searchRequest.Top ?? 50,
                                Fields = { "contentVector" }
                            }
                        }
                    };
                }

                // Add enhanced faceting
                searchOptions.Facets.Add("department,count:10");
                searchOptions.Facets.Add("documentType,count:10");
                searchOptions.Facets.Add("author,count:10");
                searchOptions.Facets.Add("fileType,count:5");
                searchOptions.Facets.Add("chunkNumber,count:10");

                // Enhanced highlighting
                searchOptions.HighlightFields.Add("content");
                searchOptions.HighlightFields.Add("title");
                searchOptions.HighlightFields.Add("description");

                // Enhanced filters
                var filters = new List<string>();
                
                if (!string.IsNullOrEmpty(searchRequest.Department))
                {
                    filters.Add($"department eq '{searchRequest.Department}'");
                }

                if (!string.IsNullOrEmpty(searchRequest.DocumentType))
                {
                    filters.Add($"documentType eq '{searchRequest.DocumentType}'");
                }
                
                if (searchRequest.OnlyOriginalDocuments ?? false)
                {
                    filters.Add("chunkNumber eq null");
                }
                
                if (filters.Any())
                {
                    searchOptions.Filter = string.Join(" and ", filters);
                }

                // Enhanced ordering
                if (!string.IsNullOrEmpty(searchRequest.OrderBy))
                {
                    searchOptions.OrderBy.Add(searchRequest.OrderBy);
                }
                else
                {
                    searchOptions.OrderBy.Add("search.score() desc");
                    searchOptions.OrderBy.Add("lastModified desc");
                }

                var searchResults = await _searchClient.SearchAsync<dynamic>(searchRequest.Search, searchOptions);

                var response = req.CreateResponse(HttpStatusCode.OK);

                var enhancedResults = new
                {
                    ODataContext = $"https://{_searchClient.Endpoint.Host}/indexes('{_searchClient.IndexName}')/$metadata#docs(*)",
                    ODataCount = searchResults.Value.TotalCount,
                    SearchType = queryEmbeddings != null ? "Hybrid (Text + Vector)" : "Text Only",
                    SemanticSearchEnabled = queryEmbeddings != null,
                    SearchFacets = searchResults.Value.Facets?.ToDictionary(
                        f => f.Key, 
                        f => f.Value.Select(v => new { Value = v.Value, Count = v.Count }).ToList()
                    ),
                    Value = searchResults.Value.GetResults().Select((result, index) => new
                    {
                        Rank = index + 1,
                        SearchScore = result.Score,
                        SearchHighlights = result.Highlights?.ToDictionary(h => h.Key, h => h.Value),
                        Document = result.Document,
                        IsChunked = result.Document?.chunkNumber != null
                    }).ToList()
                };

                await response.WriteAsJsonAsync(enhancedResults);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in enhanced search: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Enhanced search error: {ex.Message}");
                return errorResponse;
            }
        }
    }

    public class EnhancedSearchRequest
    {
        public string? Search { get; set; }
        public int? Top { get; set; }
        public int? Skip { get; set; }
        public string? Department { get; set; }
        public string? DocumentType { get; set; }
        public string? OrderBy { get; set; }
        public bool? UseSemanticSearch { get; set; } = true;
        public bool? OnlyOriginalDocuments { get; set; } = false;
    }
}