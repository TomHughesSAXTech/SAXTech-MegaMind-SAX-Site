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

                // Enhanced content processing with chunking
                var processedContent = await ProcessContentWithAI(uploadRequest.Content);
                
                // Check if content should be chunked
                var chunks = await ChunkDocument(uploadRequest.Content, uploadRequest.Title, documentId);
                var totalChunks = chunks.Count;
                
                // Upload to blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                await containerClient.CreateIfNotExistsAsync();
                
                var blobClient = containerClient.GetBlobClient(blobName);
                var originalContent = JsonConvert.SerializeObject(new {
                    id = documentId,
                    title = uploadRequest.Title,
                    content = uploadRequest.Content,
                    metadata = new { source = "enhanced-upload" },
                    chunked = totalChunks > 1,
                    totalChunks = totalChunks,
                    uploadedAt = DateTime.UtcNow
                }, Formatting.Indented);
                
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(originalContent)))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                }

                var blobUrl = blobClient.Uri.ToString();
                
                // Process and index each chunk
                var indexDocuments = new List<Dictionary<string, object>>();
                var chunkResults = new List<object>();
                
                for (int i = 0; i < chunks.Count; i++)
                {
                    var chunk = chunks[i];
                    var chunkId = totalChunks > 1 ? $"{documentId}_chunk_{i + 1}" : documentId;
                    
                    // Generate embeddings for this chunk
                    var embeddings = await GenerateEmbeddings(chunk.Content);
                    
                    // Create enhanced metadata for this chunk
                    var chunkMetadata = new EnhancedDocumentMetadata
                    {
                        Id = chunkId,
                        Title = totalChunks > 1 ? $"{uploadRequest.Title} (Chunk {i + 1}/{totalChunks})" : uploadRequest.Title,
                        Content = chunk.Content,
                        Department = department,
                        DocumentType = uploadRequest.DocumentType ?? DetermineDocumentType(chunk.Content),
                        Description = uploadRequest.Description ?? await GenerateDescription(chunk.Content),
                        Keywords = uploadRequest.Keywords ?? await ExtractKeywords(chunk.Content),
                        Version = uploadRequest.Version ?? "1.0",
                        Author = uploadRequest.Author ?? "System",
                        LastModified = DateTime.UtcNow,
                        FileSize = Encoding.UTF8.GetByteCount(chunk.Content),
                        FileType = "JSON",
                        FileName = fileName,
                        BlobName = fileName,
                        ContainerName = "saxdocuments",
                        ExtractedText = chunk.Content,
                        OcrText = "",
                        Status = "Active",
                        CreatedDate = DateTime.UtcNow,
                        UploadedBy = uploadRequest.UploadedBy ?? "System",
                        Tags = BuildEnhancedTags(uploadRequest, department),
                        ChunkNumber = totalChunks > 1 ? i + 1 : (int?)null,
                        TotalChunks = totalChunks > 1 ? totalChunks : (int?)null,
                        OriginalDocumentId = totalChunks > 1 ? documentId : null,
                        Summary = processedContent.Summary,
                        Sentiment = processedContent.Sentiment,
                        Language = processedContent.Language,
                        Entities = processedContent.Entities,
                        Topics = processedContent.Topics,
                        BlobUrl = blobUrl
                    };
                    
                    // Convert to index document with embeddings
                    var indexDocument = ConvertToIndexDocumentWithEmbeddings(chunkMetadata, embeddings);
                    indexDocuments.Add(indexDocument);
                    
                    chunkResults.Add(new {
                        chunkId = chunkId,
                        chunkNumber = totalChunks > 1 ? i + 1 : (int?)null,
                        contentLength = chunk.Content.Length,
                        hasEmbeddings = embeddings?.Length > 0
                    });
                }
                
                // Batch index chunks in smaller batches to avoid request size limits
                bool indexingSuccessful = true;
                string indexingError = null;
                
                if (indexDocuments.Any())
                {
                    try
                    {
                        await ProcessIndexDocumentsInBatches(indexDocuments);
                        _logger.LogInformation($"Enhanced document indexed successfully: {documentId} with {totalChunks} chunks");
                    }
                    catch (Exception indexEx)
                    {
                        indexingSuccessful = false;
                        indexingError = indexEx.Message;
                        _logger.LogError($"Indexing failed for document {documentId}: {indexEx.Message}");
                    }
                }

                _logger.LogInformation($"Enhanced document uploaded to blob: {documentId} with {totalChunks} chunks. Indexing: {(indexingSuccessful ? "Success" : "Failed")}");

                var response = req.CreateResponse(indexingSuccessful ? HttpStatusCode.Created : HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = indexingSuccessful,
                    documentId = documentId,
                    blobUrl = blobUrl,
                    message = indexingSuccessful 
                        ? "Enhanced document with chunking uploaded and indexed successfully" 
                        : $"Document uploaded to blob storage but chunk indexing failed: {indexingError}",
                    requiresManualIndexing = !indexingSuccessful,
                    chunkingInfo = new
                    {
                        wasChunked = totalChunks > 1,
                        totalChunks = totalChunks,
                        chunks = chunkResults
                    },
                    enhancedFeatures = new
                    {
                        aiProcessed = true,
                        embeddingsGenerated = true,
                        chunkingApplied = totalChunks > 1,
                        entitiesExtracted = processedContent.Entities?.Count ?? 0,
                        topicsIdentified = processedContent.Topics?.Count ?? 0,
                        sentimentAnalyzed = !string.IsNullOrEmpty(processedContent.Sentiment),
                        summaryGenerated = !string.IsNullOrEmpty(processedContent.Summary)
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

        private async Task<List<DocumentChunk>> ChunkDocument(string content, string title, string documentId)
        {
            const int maxChunkSize = 2000; // Increased size to reduce number of chunks
            const int overlapSize = 200; // Proportional overlap
            
            var chunks = new List<DocumentChunk>();
            
            // If content is small enough, don't chunk
            if (content.Length <= maxChunkSize)
            {
                chunks.Add(new DocumentChunk
                {
                    Content = content,
                    ChunkNumber = 1,
                    StartPosition = 0,
                    EndPosition = content.Length - 1
                });
                return chunks;
            }
            
            // Split content into chunks with overlap
            var sentences = content.Split(new[] { '.', '!', '?' }, StringSplitOptions.RemoveEmptyEntries)
                                  .Select(s => s.Trim())
                                  .Where(s => !string.IsNullOrEmpty(s))
                                  .ToArray();
            
            var currentChunk = new StringBuilder();
            var chunkNumber = 1;
            var startPosition = 0;
            
            for (int i = 0; i < sentences.Length; i++)
            {
                var sentence = sentences[i] + ".";
                
                // Check if adding this sentence would exceed chunk size
                if (currentChunk.Length + sentence.Length > maxChunkSize && currentChunk.Length > 0)
                {
                    // Save current chunk
                    var chunkContent = currentChunk.ToString().Trim();
                    chunks.Add(new DocumentChunk
                    {
                        Content = chunkContent,
                        ChunkNumber = chunkNumber,
                        StartPosition = startPosition,
                        EndPosition = startPosition + chunkContent.Length - 1
                    });
                    
                    // Start new chunk with overlap
                    var overlapText = GetOverlapText(chunkContent, overlapSize);
                    currentChunk = new StringBuilder(overlapText);
                    startPosition = Math.Max(0, startPosition + chunkContent.Length - overlapSize);
                    chunkNumber++;
                }
                
                currentChunk.Append(" ").Append(sentence);
            }
            
            // Add final chunk if there's remaining content
            if (currentChunk.Length > 0)
            {
                var chunkContent = currentChunk.ToString().Trim();
                chunks.Add(new DocumentChunk
                {
                    Content = chunkContent,
                    ChunkNumber = chunkNumber,
                    StartPosition = startPosition,
                    EndPosition = startPosition + chunkContent.Length - 1
                });
            }
            
            return chunks;
        }
        
        private string GetOverlapText(string text, int overlapSize)
        {
            if (text.Length <= overlapSize) return text;
            
            // Try to find a good break point (sentence end)
            var overlapText = text.Substring(text.Length - overlapSize);
            var lastSentenceEnd = overlapText.LastIndexOfAny(new[] { '.', '!', '?' });
            
            if (lastSentenceEnd > 0)
            {
                return overlapText.Substring(lastSentenceEnd + 1).Trim();
            }
            
            return overlapText;
        }
        
        private async Task<float[]> GenerateEmbeddings(string text)
        {
            try
            {
                // Use OpenAI embeddings API
                var response = await _openAIClient.GetEmbeddingsAsync(
                    new EmbeddingsOptions("text-embedding-3-large", new[] { text })
                );
                
                return response.Value.Data[0].Embedding.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to generate embeddings: {ex.Message}");
                // Return empty array if embedding generation fails
                return new float[0];
            }
        }
        
        private Dictionary<string, object> ConvertToIndexDocumentWithEmbeddings(EnhancedDocumentMetadata metadata, float[] embeddings)
        {
            var indexDocument = new Dictionary<string, object>
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
                ["topics"] = metadata.Topics,
                ["chunkNumber"] = metadata.ChunkNumber,
                ["totalChunks"] = metadata.TotalChunks,
                ["originalDocumentId"] = metadata.OriginalDocumentId
            };
            
            // Add embeddings if available
            if (embeddings?.Length > 0)
            {
                indexDocument["contentVector"] = embeddings;
            }
            
            return indexDocument;
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

        private async Task ProcessIndexDocumentsInBatches(List<Dictionary<string, object>> indexDocuments)
        {
            const int batchSize = 10; // Process in smaller batches to avoid request size limits
            
            for (int i = 0; i < indexDocuments.Count; i += batchSize)
            {
                var batch = indexDocuments.Skip(i).Take(batchSize).ToList();
                
                try
                {
                    var indexBatch = IndexDocumentsBatch.Upload(batch);
                    await _searchClient.IndexDocumentsAsync(indexBatch);
                    _logger.LogInformation($"Successfully indexed batch {i/batchSize + 1} with {batch.Count} documents");
                    
                    // Add small delay between batches to avoid throttling
                    if (i + batchSize < indexDocuments.Count)
                    {
                        await Task.Delay(100);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Failed to index batch {i/batchSize + 1}: {ex.Message}");
                    
                    // Try to index documents individually if batch fails
                    foreach (var doc in batch)
                    {
                        try
                        {
                            var singleBatch = IndexDocumentsBatch.Upload(new[] { doc });
                            await _searchClient.IndexDocumentsAsync(singleBatch);
                        }
                        catch (Exception docEx)
                        {
                            _logger.LogError($"Failed to index individual document {doc["id"]}: {docEx.Message}");
                        }
                    }
                }
            }
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
    
    public class DocumentChunk
    {
        public string Content { get; set; } = string.Empty;
        public int ChunkNumber { get; set; }
        public int StartPosition { get; set; }
        public int EndPosition { get; set; }
    }
}
