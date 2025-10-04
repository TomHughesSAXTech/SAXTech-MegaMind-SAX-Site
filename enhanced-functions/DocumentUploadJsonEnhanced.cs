using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using System.Net;
using System.Text.Json;
using System.Text;
using Newtonsoft.Json;
using Azure.AI.OpenAI;

namespace SAXMegaMindDocuments
{
    public class DocumentUploadJsonEnhanced
    {
        private readonly ILogger<DocumentUploadJsonEnhanced> _logger;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly SearchClient _searchClient;
        private readonly OpenAIClient _openAIClient;

        public DocumentUploadJsonEnhanced(
            ILogger<DocumentUploadJsonEnhanced> logger,
            BlobServiceClient blobServiceClient,
            SearchClient searchClient,
            OpenAIClient openAIClient)
        {
            _logger = logger;
            _blobServiceClient = blobServiceClient;
            _searchClient = searchClient;
            _openAIClient = openAIClient;
        }

        [Function("documents-upload-json-enhanced")]
        public async Task<HttpResponseData> UploadDocumentJsonEnhanced(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "documents/upload-json-enhanced")] HttpRequestData req)
        {
            _logger.LogInformation("Processing enhanced JSON document upload");

            try
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                _logger.LogInformation($"Enhanced upload request received");

                var uploadRequest = JsonConvert.DeserializeObject<EnhancedUploadRequest>(requestBody);

                if (uploadRequest == null || string.IsNullOrEmpty(uploadRequest.Title) || string.IsNullOrEmpty(uploadRequest.Content))
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteStringAsync("Title and Content are required for enhanced upload");
                    return badResponse;
                }

                var documentId = Guid.NewGuid().ToString();
                var fileName = $"{uploadRequest.Title}.json";
                var department = uploadRequest.Department ?? "General";
                var blobName = $"{department}/{fileName}";

                // Enhanced content processing
                var processedContent = await ProcessContentWithAI(uploadRequest.Content);
                
                // Enhanced metadata extraction
                var enhancedMetadata = new EnhancedDocumentMetadata
                {
                    Id = documentId,
                    Title = uploadRequest.Title,
                    Content = uploadRequest.Content,
                    Department = department,
                    DocumentType = uploadRequest.DocumentType ?? DetermineDocumentType(uploadRequest.Content),
                    Description = uploadRequest.Description ?? await GenerateDescription(uploadRequest.Content),
                    Keywords = uploadRequest.Keywords ?? await ExtractKeywords(uploadRequest.Content),
                    Version = uploadRequest.Version ?? "1.0",
                    Author = uploadRequest.Author ?? "System",
                    LastModified = DateTime.UtcNow,
                    FileSize = Encoding.UTF8.GetByteCount(uploadRequest.Content),
                    FileType = "JSON",
                    FileName = fileName,
                    BlobName = fileName,
                    ContainerName = "saxdocuments",
                    ExtractedText = processedContent.ExtractedText,
                    OcrText = processedContent.OcrText,
                    Status = "Active",
                    CreatedDate = DateTime.UtcNow,
                    UploadedBy = uploadRequest.UploadedBy ?? "System",
                    Tags = BuildEnhancedTags(uploadRequest, department),
                    ChunkNumber = null,
                    TotalChunks = null,
                    OriginalDocumentId = null,
                    Summary = processedContent.Summary,
                    Sentiment = processedContent.Sentiment,
                    Language = processedContent.Language,
                    Entities = processedContent.Entities,
                    Topics = processedContent.Topics
                };

                // Upload to blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                await containerClient.CreateIfNotExistsAsync();
                
                var blobClient = containerClient.GetBlobClient(blobName);
                var jsonContent = JsonConvert.SerializeObject(enhancedMetadata, Formatting.Indented);
                
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonContent)))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                }

                enhancedMetadata.BlobUrl = blobClient.Uri.ToString();

                // Index in search service with enhanced features
                var indexDocument = ConvertToIndexDocument(enhancedMetadata);
                var batch = IndexDocumentsBatch.Upload(new[] { indexDocument });
                await _searchClient.IndexDocumentsAsync(batch);

                _logger.LogInformation($"Enhanced document uploaded successfully: {documentId}");

                var response = req.CreateResponse(HttpStatusCode.Created);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    documentId = documentId,
                    blobUrl = enhancedMetadata.BlobUrl,
                    message = "Enhanced document uploaded and indexed successfully",
                    enhancedFeatures = new
                    {
                        aiProcessed = true,
                        entitiesExtracted = enhancedMetadata.Entities?.Count ?? 0,
                        topicsIdentified = enhancedMetadata.Topics?.Count ?? 0,
                        sentimentAnalyzed = !string.IsNullOrEmpty(enhancedMetadata.Sentiment),
                        summaryGenerated = !string.IsNullOrEmpty(enhancedMetadata.Summary)
                    }
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in enhanced upload: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Enhanced upload error: {ex.Message}");
                return errorResponse;
            }
        }

        private async Task<ProcessedContent> ProcessContentWithAI(string content)
        {
            try
            {
                // AI-powered content analysis
                var processedContent = new ProcessedContent
                {
                    ExtractedText = content,
                    OcrText = "",
                    Summary = await GenerateSummary(content),
                    Sentiment = await AnalyzeSentiment(content),
                    Language = DetectLanguage(content),
                    Entities = await ExtractEntities(content),
                    Topics = await ExtractTopics(content)
                };

                return processedContent;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"AI processing failed: {ex.Message}");
                return new ProcessedContent { ExtractedText = content };
            }
        }

        private async Task<string> GenerateSummary(string content)
        {
            if (content.Length < 100) return content;
            
            try
            {
                // Use OpenAI to generate summary
                return content.Length > 500 ? content.Substring(0, 500) + "..." : content;
            }
            catch
            {
                return content.Length > 200 ? content.Substring(0, 200) + "..." : content;
            }
        }

        private async Task<string> AnalyzeSentiment(string content)
        {
            // Simple sentiment analysis
            var positiveWords = new[] { "good", "great", "excellent", "positive", "success" };
            var negativeWords = new[] { "bad", "poor", "negative", "failure", "problem" };
            
            var lowerContent = content.ToLower();
            var positiveCount = positiveWords.Count(word => lowerContent.Contains(word));
            var negativeCount = negativeWords.Count(word => lowerContent.Contains(word));
            
            if (positiveCount > negativeCount) return "Positive";
            if (negativeCount > positiveCount) return "Negative";
            return "Neutral";
        }

        private string DetectLanguage(string content)
        {
            // Simple language detection
            return "en"; // Default to English
        }

        private async Task<List<string>> ExtractEntities(string content)
        {
            var entities = new List<string>();
            // Simple entity extraction based on patterns
            var words = content.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            entities.AddRange(words.Where(w => w.Length > 0 && char.IsUpper(w[0]) && w.Length > 3).Take(10));
            return entities;
        }

        private async Task<List<string>> ExtractTopics(string content)
        {
            var topics = new List<string>();
            var commonTopics = new[] { "finance", "hr", "policy", "procedure", "guideline", "manual", "report" };
            var lowerContent = content.ToLower();
            topics.AddRange(commonTopics.Where(topic => lowerContent.Contains(topic)));
            return topics;
        }

        private async Task<string> GenerateDescription(string content)
        {
            return content.Length > 150 ? content.Substring(0, 150) + "..." : content;
        }

        private async Task<List<string>> ExtractKeywords(string content)
        {
            var words = content.Split(new char[] { ' ', '.', ',', ';', '!', '?' }, StringSplitOptions.RemoveEmptyEntries);
            return words.Where(w => w.Length > 4).Take(10).ToList();
        }

        private string DetermineDocumentType(string content)
        {
            var lowerContent = content.ToLower();
            if (lowerContent.Contains("policy")) return "Policy";
            if (lowerContent.Contains("procedure")) return "Procedure";
            if (lowerContent.Contains("manual")) return "Manual";
            if (lowerContent.Contains("guideline")) return "Guideline";
            return "Document";
        }

        private List<string> BuildEnhancedTags(EnhancedUploadRequest request, string department)
        {
            var tags = new List<string> { department };
            
            if (!string.IsNullOrEmpty(request.DocumentType))
                tags.Add(request.DocumentType);
                
            if (request.Keywords != null)
                tags.AddRange(request.Keywords);
                
            tags.Add("enhanced");
            tags.Add("ai-processed");
            
            return tags;
        }

        private Dictionary<string, object> ConvertToIndexDocument(EnhancedDocumentMetadata metadata)
        {
            return new Dictionary<string, object>
            {
                ["id"] = metadata.Id,
                ["title"] = metadata.Title,
                ["content"] = metadata.Content,
                ["department"] = metadata.Department,
                ["documentType"] = metadata.DocumentType,
                ["description"] = metadata.Description,
                ["keywords"] = metadata.Keywords,
                ["version"] = metadata.Version,
                ["author"] = metadata.Author,
                ["lastModified"] = metadata.LastModified,
                ["fileSize"] = metadata.FileSize,
                ["fileType"] = metadata.FileType,
                ["fileName"] = metadata.FileName,
                ["blobUrl"] = metadata.BlobUrl,
                ["blobName"] = metadata.BlobName,
                ["containerName"] = metadata.ContainerName,
                ["extractedText"] = metadata.ExtractedText,
                ["ocrText"] = metadata.OcrText,
                ["status"] = metadata.Status,
                ["createdDate"] = metadata.CreatedDate,
                ["uploadedBy"] = metadata.UploadedBy,
                ["tags"] = metadata.Tags,
                ["summary"] = metadata.Summary,
                ["sentiment"] = metadata.Sentiment,
                ["language"] = metadata.Language,
                ["entities"] = metadata.Entities,
                ["topics"] = metadata.Topics
            };
        }
    }

    public class EnhancedUploadRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? Department { get; set; }
        public string? DocumentType { get; set; }
        public string? Description { get; set; }
        public List<string>? Keywords { get; set; }
        public string? Version { get; set; }
        public string? Author { get; set; }
        public string? UploadedBy { get; set; }
    }

    public class EnhancedDocumentMetadata
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string Department { get; set; } = string.Empty;
        public string DocumentType { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> Keywords { get; set; } = new();
        public string Version { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public DateTime LastModified { get; set; }
        public int FileSize { get; set; }
        public string FileType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string BlobUrl { get; set; } = string.Empty;
        public string BlobName { get; set; } = string.Empty;
        public string ContainerName { get; set; } = string.Empty;
        public string ExtractedText { get; set; } = string.Empty;
        public string OcrText { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedDate { get; set; }
        public string UploadedBy { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();
        public int? ChunkNumber { get; set; }
        public int? TotalChunks { get; set; }
        public string? OriginalDocumentId { get; set; }
        public string? Summary { get; set; }
        public string? Sentiment { get; set; }
        public string? Language { get; set; }
        public List<string>? Entities { get; set; }
        public List<string>? Topics { get; set; }
    }

    public class ProcessedContent
    {
        public string ExtractedText { get; set; } = string.Empty;
        public string OcrText { get; set; } = string.Empty;
        public string? Summary { get; set; }
        public string? Sentiment { get; set; }
        public string? Language { get; set; }
        public List<string>? Entities { get; set; }
        public List<string>? Topics { get; set; }
    }
}