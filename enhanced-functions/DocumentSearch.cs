using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.AI.OpenAI;
using System.Net;
using Newtonsoft.Json;

namespace SAXMegaMindDocuments
{
    public class DocumentSearch
    {
        private readonly ILogger<DocumentSearch> _logger;
        private readonly SearchClient _searchClient;
        private readonly OpenAIClient _openAIClient;

        public DocumentSearch(
            ILogger<DocumentSearch> logger,
            SearchClient searchClient,
            OpenAIClient openAIClient)
        {
            _logger = logger;
            _searchClient = searchClient;
            _openAIClient = openAIClient;
        }

        [Function("documents-search")]
        public async Task<HttpResponseData> Search(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "documents/search")] HttpRequestData req)
        {
            _logger.LogInformation("Processing document search request");

            try
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var searchRequest = JsonConvert.DeserializeObject<SearchRequest>(requestBody);

                // Get the actual query string using the computed property
                var queryString = searchRequest?.GetQueryString();
                
                if (string.IsNullOrWhiteSpace(queryString))
                {
                    queryString = "*"; // Default to all documents
                }

                // Build search options
                var pageSize = searchRequest.GetPageSize();
                var searchOptions = new SearchOptions
                {
                    Size = pageSize,
                    Skip = ((searchRequest.Page ?? 1) - 1) * pageSize,
                    IncludeTotalCount = true,
                    QueryType = SearchQueryType.Simple, // Use Simple for better compatibility
                    SearchMode = SearchMode.Any // Use Any for broader matches
                };

                // Add filters - support both specific filters and generic filter field
                if (!string.IsNullOrEmpty(searchRequest.Filter))
                {
                    searchOptions.Filter = searchRequest.Filter;
                }
                else
                {
                    if (!string.IsNullOrEmpty(searchRequest.Department))
                    {
                        searchOptions.Filter = $"department eq '{searchRequest.Department}'";
                    }

                    if (!string.IsNullOrEmpty(searchRequest.DocumentType))
                    {
                        var typeFilter = $"documentType eq '{searchRequest.DocumentType}'";
                        searchOptions.Filter = string.IsNullOrEmpty(searchOptions.Filter) 
                            ? typeFilter 
                            : $"{searchOptions.Filter} and {typeFilter}";
                    }
                }

                // Don't specify select fields at all - let Azure Search return all fields
                // This avoids errors from requesting non-existent fields
                // The frontend is requesting fields that may not exist in the index
                // like 'uploadDate', 'author', 'fileSize' etc.
                // By not specifying Select, we get all available fields back

                // Don't specify search fields to search all searchable fields
                // This avoids errors from non-existent fields
                // Azure Search will automatically search all searchable fields

                // Only add facets if we know they exist
                // For now, don't add any facets to avoid errors

                // Perform vector search if enabled
                SearchResults<SearchDocument> searchResults;
                
                // Temporarily disabled until embeddings are working
                if (false && searchRequest.UseVectorSearch == true && queryString != "*")
                {
                    // Generate embeddings for the query
                    var embeddingOptions = new EmbeddingsOptions(
                        "text-embedding-ada-002",
                        new[] { queryString });

                    var embeddingResponse = await _openAIClient.GetEmbeddingsAsync(embeddingOptions);
                    var queryEmbeddings = embeddingResponse.Value.Data[0].Embedding.ToArray();

                    // Perform hybrid search (text + vector)
                    var vectorSearchOptions = new VectorizedQuery(queryEmbeddings)
                    {
                        KNearestNeighborsCount = searchRequest.VectorSearchK ?? 5,
                        Fields = { "contentVector" }
                    };

                    searchOptions.VectorSearch = new VectorSearchOptions();
                    searchOptions.VectorSearch.Queries.Add(vectorSearchOptions);
                }

                // Execute search
                searchResults = await _searchClient.SearchAsync<SearchDocument>(queryString, searchOptions);

                // Process results - return raw documents for frontend compatibility
                var results = new List<Dictionary<string, object>>();
                await foreach (var result in searchResults.GetResultsAsync())
                {
                    var doc = new Dictionary<string, object>();
                    foreach (var kvp in result.Document)
                    {
                        // Handle keywords specially to ensure it's a list
                        if (kvp.Key == "keywords" && kvp.Value is IEnumerable<object> keywordsList)
                        {
                            doc[kvp.Key] = keywordsList.Select(k => k?.ToString()).Where(k => k != null).ToList();
                        }
                        else
                        {
                            doc[kvp.Key] = kvp.Value;
                        }
                    }
                    
                    // Add score if available
                    if (result.Score.HasValue)
                    {
                        doc["@search.score"] = result.Score.Value;
                    }
                    
                    results.Add(doc);
                }

                // Process facets
                var facets = new Dictionary<string, List<FacetValue>>();
                if (searchResults.Facets != null)
                {
                    foreach (var facet in searchResults.Facets)
                    {
                        facets[facet.Key] = facet.Value
                            .Select(f => new FacetValue 
                            { 
                                Value = f.Value.ToString(), 
                                Count = f.Count ?? 0 
                            })
                            .ToList();
                    }
                }

                var response = req.CreateResponse(HttpStatusCode.OK);
                
                // Create response object compatible with frontend
                var responseObject = new Dictionary<string, object>
                {
                    ["@odata.count"] = searchResults.TotalCount,
                    ["value"] = results,
                    ["facets"] = facets,
                    // Also include alternative fields for compatibility
                    ["success"] = true,
                    ["totalCount"] = searchResults.TotalCount,
                    ["page"] = searchRequest.Page ?? 1,
                    ["pageSize"] = pageSize,
                    ["results"] = results
                };
                
                await response.WriteAsJsonAsync(responseObject);

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in document search: {0}", ex.Message);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Error processing search: {ex.Message}");
                return errorResponse;
            }
        }


        private string TruncateContent(string content, int maxLength)
        {
            if (string.IsNullOrEmpty(content) || content.Length <= maxLength)
                return content;

            return content.Substring(0, maxLength) + "...";
        }
    }

    public class SearchRequest
    {
        public string Query { get; set; }
        public string Search { get; set; } // Support both 'search' and 'query' fields
        public string Department { get; set; }
        public string DocumentType { get; set; }
        public string Filter { get; set; } // Support filter field
        
        // Support select field as both string and array
        private object _select;
        public object Select 
        { 
            get => _select;
            set => _select = value;
        }
        
        // Get select fields as a list
        public List<string> GetSelectFields()
        {
            if (_select == null) return null;
            
            if (_select is string selectString)
            {
                // Handle comma-separated string
                return selectString.Split(',').Select(s => s.Trim()).ToList();
            }
            else if (_select is Newtonsoft.Json.Linq.JArray jsonArray)
            {
                // Handle JSON array
                return jsonArray.ToObject<List<string>>();
            }
            else if (_select is List<string> stringList)
            {
                return stringList;
            }
            else if (_select is IEnumerable<object> objList)
            {
                return objList.Select(o => o?.ToString()).Where(s => s != null).ToList();
            }
            
            return null;
        }
        
        public int? Top { get; set; } // Support 'top' field in addition to PageSize
        public int? Page { get; set; }
        public int? PageSize { get; set; }
        public bool? UseVectorSearch { get; set; }
        public int? VectorSearchK { get; set; }
        
        // Computed property to get the actual query string
        public string GetQueryString() => Query ?? Search ?? "*";
        
        // Computed property to get the actual page size
        public int GetPageSize() => Top ?? PageSize ?? 10;
    }

    public class DocumentSearchResult
    {
        public string Id { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public string Department { get; set; }
        public string DocumentType { get; set; }
        public string Description { get; set; }
        public List<string> Keywords { get; set; }
        public string Version { get; set; }
        public string Author { get; set; }
        public DateTimeOffset? LastModified { get; set; }
        public string FileType { get; set; }
        public string BlobUrl { get; set; }
        public double Score { get; set; }
        public IDictionary<string, IList<string>> Highlights { get; set; }
        public string ExtractedText { get; set; }
        public string OcrText { get; set; }
    }

    public class FacetValue
    {
        public string Value { get; set; }
        public long Count { get; set; }
    }
}
