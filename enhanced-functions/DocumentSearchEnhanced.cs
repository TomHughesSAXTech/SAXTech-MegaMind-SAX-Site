using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using System.Net;
using System.Text.Json;
using Newtonsoft.Json;

namespace SAXMegaMindDocuments
{
    public class DocumentSearchEnhanced
    {
        private readonly ILogger<DocumentSearchEnhanced> _logger;
        private readonly SearchClient _searchClient;

        public DocumentSearchEnhanced(ILogger<DocumentSearchEnhanced> logger, SearchClient searchClient)
        {
            _logger = logger;
            _searchClient = searchClient;
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

                // Enhanced search options
                var searchOptions = new SearchOptions
                {
                    IncludeTotalCount = true,
                    Size = searchRequest.Top ?? 50,
                    Skip = searchRequest.Skip ?? 0,
                    QueryType = SearchQueryType.Full
                };

                // Add enhanced faceting
                searchOptions.Facets.Add("department,count:10");
                searchOptions.Facets.Add("documentType,count:10");
                searchOptions.Facets.Add("author,count:10");
                searchOptions.Facets.Add("fileType,count:5");

                // Enhanced highlighting
                searchOptions.HighlightFields.Add("content");
                searchOptions.HighlightFields.Add("title");
                searchOptions.HighlightFields.Add("description");

                // Enhanced filters
                if (!string.IsNullOrEmpty(searchRequest.Department))
                {
                    searchOptions.Filter = $"department eq '{searchRequest.Department}'";
                }

                if (!string.IsNullOrEmpty(searchRequest.DocumentType))
                {
                    var filter = string.IsNullOrEmpty(searchOptions.Filter) 
                        ? $"documentType eq '{searchRequest.DocumentType}'"
                        : $"{searchOptions.Filter} and documentType eq '{searchRequest.DocumentType}'";
                    searchOptions.Filter = filter;
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
                    SearchFacets = searchResults.Value.Facets?.ToDictionary(
                        f => f.Key, 
                        f => f.Value.Select(v => new { Value = v.Value, Count = v.Count }).ToList()
                    ),
                    Value = searchResults.Value.GetResults().Select(result => new
                    {
                        SearchScore = result.Score,
                        SearchHighlights = result.Highlights?.ToDictionary(h => h.Key, h => h.Value),
                        Document = result.Document
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
    }
}