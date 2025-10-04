using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Azure.AI.OpenAI;
using Azure;
using System.Net;
using System.Text;
using System.Security.Cryptography;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Threading.Tasks;
using System;

namespace SAXMegaMindDocuments
{
    public class DocumentUploadJson
    {
        private readonly ILogger<DocumentUploadJson> _logger;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly SearchClient _searchClient;
        private readonly DocumentAnalysisClient _documentAnalysisClient;
        private readonly OpenAIClient _openAIClient;
        
        // Configuration from environment variables
        private readonly string OPENAI_ENDPOINT = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? "https://client-fcs.cognitiveservices.azure.com/";
        private readonly string OPENAI_KEY = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY") ?? "7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6";
        private readonly string DOCINTEL_ENDPOINT = Environment.GetEnvironmentVariable("DocumentIntelligenceEndpoint") ?? "https://eastus2.api.cognitive.microsoft.com/";
        private readonly string DOCINTEL_KEY = Environment.GetEnvironmentVariable("DocumentIntelligenceKey") ?? "a657a34443a849fa95691fcf6aafc47d";
        private readonly string EMBEDDING_DEPLOYMENT = Environment.GetEnvironmentVariable("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME") ?? "text-embedding-3-large";
        private readonly int CHUNK_SIZE = int.TryParse(Environment.GetEnvironmentVariable("CHUNK_SIZE"), out var cs) ? cs : 1000;
        private readonly int CHUNK_OVERLAP = int.TryParse(Environment.GetEnvironmentVariable("CHUNK_OVERLAP"), out var co) ? co : 200;
        private const int DEFAULT_MAX_CONTENT_LENGTH = 30000; // Default limit for large PDFs
        private const int MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB max file size

        public DocumentUploadJson(
            ILogger<DocumentUploadJson> logger,
            BlobServiceClient blobServiceClient,
            SearchClient searchClient,
            DocumentAnalysisClient documentAnalysisClient,
            OpenAIClient openAIClient)
        {
            _logger = logger;
            _blobServiceClient = blobServiceClient;
            _searchClient = searchClient;
            _documentAnalysisClient = documentAnalysisClient;
            _openAIClient = openAIClient;
        }

        [Function("documents-upload-json")]
        public async Task<HttpResponseData> UploadDocumentJson(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "documents/upload-json")] HttpRequestData req)
        {
            _logger.LogInformation("Processing enhanced JSON document upload request");

            try
            {
                // Parse JSON request
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var uploadRequest = JsonConvert.DeserializeObject<UploadRequest>(requestBody);

                if (uploadRequest == null || string.IsNullOrEmpty(uploadRequest.FileContent))
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await errorResponse.WriteStringAsync("No file content provided");
                    return errorResponse;
                }

                // Log the received department to debug
                _logger.LogInformation($"Received Department: '{uploadRequest.Department}', DocumentType: '{uploadRequest.DocumentType}', SopType: '{uploadRequest.SopType}'");

                // Convert base64 to bytes
                var fileContent = Convert.FromBase64String(uploadRequest.FileContent);
                
                _logger.LogInformation($"Processing file: {uploadRequest.FileName}, Size: {fileContent.Length} bytes");
                
                // Check file size
                if (fileContent.Length > MAX_FILE_SIZE)
                {
                    _logger.LogWarning($"File too large: {fileContent.Length} bytes (max: {MAX_FILE_SIZE})");
                    var errorResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await errorResponse.WriteStringAsync($"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB");
                    return errorResponse;
                }
                
                // Generate content hash for deduplication
                string contentHash;
                using (var sha256 = SHA256.Create())
                {
                    var hashBytes = sha256.ComputeHash(fileContent);
                    contentHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();
                }

                // Check for duplicate documents in search index
                var existingDocId = await CheckForDuplicate(contentHash);
                var documentId = existingDocId ?? Guid.NewGuid().ToString();
                bool isDuplicate = existingDocId != null;

                if (isDuplicate)
                {
                    _logger.LogInformation($"Duplicate document detected with hash {contentHash}, updating existing document {documentId}");
                }

                // Upload to Blob Storage (overwrite if duplicate)
                var containerClient = _blobServiceClient.GetBlobContainerClient("saxdocuments");
                await containerClient.CreateIfNotExistsAsync();

                var docType = uploadRequest.SopType ?? uploadRequest.DocumentType ?? "General";
                
                // Handle department - DO NOT default to General if provided
                var dept = uploadRequest.Department;
                
                // Map short department names to proper names if needed
                if (dept == "HR") dept = "Human Resources";
                
                // Only default to General if department is truly empty/null
                if (string.IsNullOrWhiteSpace(dept))
                {
                    dept = "General";
                    _logger.LogWarning($"No department specified, defaulting to 'General'");
                }
                else
                {
                    _logger.LogInformation($"Using department: '{dept}'");
                }
                
                var blobPath = $"{dept}/{uploadRequest.FileName}";
                var blobClient = containerClient.GetBlobClient(blobPath);
                
                // Set content type based on file extension
                var contentType = GetContentType(uploadRequest.FileName);
                var blobOptions = new BlobUploadOptions
                {
                    HttpHeaders = new BlobHttpHeaders { ContentType = contentType }
                };
                
                using (var stream = new MemoryStream(fileContent))
                {
                    await blobClient.UploadAsync(stream, blobOptions);
                }

                var blobUrl = blobClient.Uri.ToString();
                _logger.LogInformation($"File uploaded to blob storage: {blobUrl}");

                // Check if full text extraction is requested
                bool requestFullTextExtraction = uploadRequest.FullTextExtraction ?? false;
                int maxTextLength = uploadRequest.MaxTextLength ?? DEFAULT_MAX_CONTENT_LENGTH;
                
                // If MaxTextLength is 0, treat as unlimited
                if (maxTextLength == 0)
                {
                    maxTextLength = int.MaxValue;
                    requestFullTextExtraction = true;
                }

                // Extract text with configurable handling for large PDFs
                string extractedText = "";
                string ocrText = "";
                bool isLargePdf = Path.GetExtension(uploadRequest.FileName)?.ToLower() == ".pdf" && fileContent.Length > 1024 * 1024; // > 1MB
                
                try
                {
                    if (isLargePdf && !requestFullTextExtraction)
                    {
                        // Original limited extraction for large PDFs (only if full extraction not requested)
                        _logger.LogInformation($"Processing large PDF ({fileContent.Length / 1024}KB) with limited extraction");
                        
                        try
                        {
                            extractedText = ExtractLimitedPdfText(fileContent, _logger, DEFAULT_MAX_CONTENT_LENGTH, 10);
                            _logger.LogInformation($"Extracted {extractedText.Length} characters from large PDF (limited mode)");
                        }
                        catch (Exception pdfEx)
                        {
                            _logger.LogWarning($"Large PDF extraction failed: {pdfEx.Message}");
                            extractedText = "";
                        }
                    }
                    else
                    {
                        // Full extraction for all files when requested or for non-large PDFs
                        if (isLargePdf && requestFullTextExtraction)
                        {
                            _logger.LogInformation($"Processing large PDF ({fileContent.Length / 1024}KB) with FULL text extraction as requested");
                            
                            try
                            {
                                // Extract ALL pages for large PDFs when full extraction is requested
                                extractedText = ExtractFullPdfText(fileContent, _logger, maxTextLength);
                                _logger.LogInformation($"Extracted {extractedText.Length} characters from large PDF (full extraction mode)");
                            }
                            catch (Exception pdfEx)
                            {
                                _logger.LogWarning($"Full PDF extraction failed, falling back to normal extraction: {pdfEx.Message}");
                                extractedText = DocumentTextExtractor.ExtractText(fileContent, uploadRequest.FileName, _logger);
                            }
                        }
                        else
                        {
                            // Normal extraction for other files
                            extractedText = DocumentTextExtractor.ExtractText(fileContent, uploadRequest.FileName, _logger);
                            
                            if (!string.IsNullOrWhiteSpace(extractedText))
                            {
                                _logger.LogInformation($"Extracted {extractedText.Length} characters using DocumentTextExtractor");
                            }
                        }
                    }
                    
                    // Use Document Intelligence only if text extraction failed and not a large PDF (or if full extraction requested)
                    if (string.IsNullOrWhiteSpace(extractedText) && (!isLargePdf || requestFullTextExtraction))
                    {
                        try
                        {
                            var docIntelClient = new DocumentAnalysisClient(
                                new Uri(DOCINTEL_ENDPOINT),
                                new AzureKeyCredential(DOCINTEL_KEY));
                            
                            using (var stream = new MemoryStream(fileContent))
                            {
                                var operation = await docIntelClient.AnalyzeDocumentAsync(
                                    WaitUntil.Completed,
                                    "prebuilt-document",
                                    stream);

                                var result = operation.Value;
                                
                                // Extract all text from pages
                                var allLines = result.Pages.SelectMany(p => p.Lines).Select(l => l.Content);
                                extractedText = string.Join(" ", allLines);
                                
                                // Extract text from any detected tables
                                if (result.Tables != null && result.Tables.Any())
                                {
                                    foreach (var table in result.Tables)
                                    {
                                        foreach (var cell in table.Cells)
                                        {
                                            extractedText += " " + cell.Content;
                                        }
                                    }
                                }
                                
                                _logger.LogInformation($"Extracted {extractedText.Length} characters using Document Intelligence");
                            }
                        }
                        catch (Exception docEx)
                        {
                            _logger.LogWarning($"Document Intelligence extraction failed: {docEx.Message}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Text extraction failed: {ex.Message}");
                    extractedText = "";
                }

                // Chunk the document for better RAG performance
                var fullContent = string.IsNullOrWhiteSpace(extractedText) ? ocrText : extractedText;
                var chunks = ChunkText(fullContent, CHUNK_SIZE, CHUNK_OVERLAP);
                var searchDocuments = new List<Dictionary<string, object>>();
                
                _logger.LogInformation($"Created {chunks.Count} chunks from document content");
                
                // Generate embeddings and create documents for each chunk
                var openAIClient = _openAIClient ?? new OpenAIClient(
                    new Uri(OPENAI_ENDPOINT),
                    new AzureKeyCredential(OPENAI_KEY));
                    
                for (int i = 0; i < chunks.Count; i++)
                {
                    var chunk = chunks[i];
                    var chunkId = chunks.Count == 1 ? documentId : $"{documentId}-chunk-{i + 1}";
                    
                    // Generate embeddings for this chunk
                    float[] embeddings = null;
                    try
                    {
                        if (!string.IsNullOrWhiteSpace(chunk))
                        {
                            // Use limited text for embedding
                            var embeddingText = chunk.Length > 8000 ? chunk.Substring(0, 8000) : chunk;
                            
                            var embeddingOptions = new EmbeddingsOptions(
                                EMBEDDING_DEPLOYMENT,
                                new[] { embeddingText });

                            var embeddingResponse = await openAIClient.GetEmbeddingsAsync(embeddingOptions);
                            embeddings = embeddingResponse.Value.Data[0].Embedding.ToArray();
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Embedding generation failed for chunk {i + 1}: {ex.Message}");
                        // Continue without embeddings for this chunk
                    }
                    
                    // Create search document for this chunk
                    var searchDocument = new Dictionary<string, object>
                    {
                        ["id"] = chunkId,
                        ["title"] = Path.GetFileNameWithoutExtension(uploadRequest.FileName),
                        ["content"] = chunk,
                        ["contentVector"] = embeddings,
                        ["contentHash"] = contentHash,
                        ["department"] = dept,
                        ["documentType"] = docType,
                        ["description"] = uploadRequest.Description ?? "",
                        ["keywords"] = uploadRequest.Keywords?.ToArray() ?? Array.Empty<string>(),
                        ["version"] = uploadRequest.Version ?? "1.0",
                        ["author"] = "System",
                        ["lastModified"] = DateTimeOffset.UtcNow,
                        ["fileSize"] = fileContent.Length,
                        ["fileType"] = Path.GetExtension(uploadRequest.FileName).TrimStart('.').ToUpper(),
                        ["fileName"] = uploadRequest.FileName,
                        ["blobUrl"] = blobUrl,
                        ["blobName"] = uploadRequest.FileName,
                        ["containerName"] = "saxdocuments",
                        ["extractedText"] = extractedText,
                        ["ocrText"] = ocrText,
                        ["status"] = "Active",
                        ["createdDate"] = isDuplicate ? (object)await GetOriginalCreatedDate(documentId) : DateTimeOffset.UtcNow,
                        ["uploadedBy"] = "System",
                        ["tags"] = new List<string> { dept, docType },
                        ["chunkNumber"] = chunks.Count == 1 ? (object?)null : i + 1,
                        ["totalChunks"] = chunks.Count == 1 ? (object?)null : chunks.Count,
                        ["originalDocumentId"] = chunks.Count == 1 ? (object?)null : documentId
                    };
                    
                    searchDocuments.Add(searchDocument);
                }

                // Index all document chunks in Azure AI Search using batch processing to avoid 413 errors
                try
                {
                    await ProcessIndexDocumentsInBatches(searchDocuments, isDuplicate);
                    _logger.LogInformation($"All {searchDocuments.Count} document chunks indexed successfully for: {documentId}");
                }
                catch (Exception indexEx)
                {
                    _logger.LogError(indexEx, $"Failed to index document chunks {documentId}: {indexEx.Message}");
                    
                    // Still return partial success since blob upload worked
                    var partialResponse = req.CreateResponse(HttpStatusCode.PartialContent);
                    await partialResponse.WriteAsJsonAsync(new
                    {
                        success = false,
                        documentId = documentId,
                        blobUrl = blobUrl,
                        message = $"Document uploaded to blob storage but chunk indexing failed: {indexEx.Message}",
                        requiresManualIndexing = true
                    });
                    return partialResponse;
                }

                // Return success response with chunking info
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    documentId = documentId,
                    blobUrl = blobUrl,
                    isDuplicate = isDuplicate,
                    extractedTextLength = extractedText.Length,
                    isLargePdf = isLargePdf,
                    fullTextExtraction = requestFullTextExtraction,
                    department = dept,
                    chunksCreated = chunks.Count,
                    chunkSize = CHUNK_SIZE,
                    chunkOverlap = CHUNK_OVERLAP,
                    message = isDuplicate 
                        ? $"Duplicate document updated successfully with {chunks.Count} chunks" 
                        : isLargePdf 
                            ? requestFullTextExtraction
                                ? $"Large PDF uploaded and indexed with FULL text extraction ({chunks.Count} chunks)"
                                : $"Large PDF uploaded and indexed with limited text extraction ({chunks.Count} chunks)"
                            : $"Document uploaded and indexed successfully ({chunks.Count} chunks)"
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing document upload: {0}", ex.Message);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new
                {
                    error = true,
                    message = $"Error processing upload: {ex.Message}",
                    details = ex.ToString()
                });
                return errorResponse;
            }
        }

        private static string ExtractFullPdfText(byte[] fileContent, ILogger logger, int maxLength)
        {
            try
            {
                var text = new StringBuilder();
                using (var document = UglyToad.PdfPig.PdfDocument.Open(fileContent))
                {
                    int pageCount = 0;
                    foreach (var page in document.GetPages())
                    {
                        if (text.Length >= maxLength && maxLength != int.MaxValue)
                            break;
                            
                        pageCount++;
                        
                        var pageText = UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor.ContentOrderTextExtractor.GetText(page);
                        text.Append(pageText);
                        text.Append(" ");
                        
                        // Log progress every 10 pages
                        if (pageCount % 10 == 0)
                        {
                            logger?.LogInformation($"Extracted text from {pageCount} pages so far...");
                        }
                    }
                    
                    logger?.LogInformation($"Extracted text from ALL {pageCount} pages of PDF");
                }
                
                var result = text.ToString();
                if (result.Length > maxLength && maxLength != int.MaxValue)
                    result = result.Substring(0, maxLength);
                    
                return result;
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"Full PDF extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private static string ExtractLimitedPdfText(byte[] fileContent, ILogger logger, int maxLength, int maxPages)
        {
            try
            {
                var text = new StringBuilder();
                using (var document = UglyToad.PdfPig.PdfDocument.Open(fileContent))
                {
                    int pageCount = 0;
                    foreach (var page in document.GetPages())
                    {
                        if (text.Length >= maxLength)
                            break;
                            
                        pageCount++;
                        if (pageCount > maxPages) // Limit pages for large PDFs
                            break;
                            
                        var pageText = UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor.ContentOrderTextExtractor.GetText(page);
                        text.Append(pageText);
                        text.Append(" ");
                    }
                    
                    logger?.LogInformation($"Extracted text from {pageCount} pages of PDF (limited to {maxPages} pages)");
                }
                
                var result = text.ToString();
                if (result.Length > maxLength)
                    result = result.Substring(0, maxLength);
                    
                return result;
            }
            catch (Exception ex)
            {
                logger?.LogWarning($"Limited PDF extraction failed: {ex.Message}");
                return string.Empty;
            }
        }

        private async Task<string> CheckForDuplicate(string contentHash)
        {
            try
            {
                var searchOptions = new SearchOptions
                {
                    Filter = $"contentHash eq '{contentHash}'",
                    Size = 1,
                    Select = { "id" }
                };
                
                var searchResults = await _searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    if (result.Document.TryGetValue("id", out var id))
                    {
                        return id?.ToString();
                    }
                    break; // Only need first result
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Error checking for duplicate: {ex.Message}");
            }
            return null;
        }

        private async Task<DateTimeOffset> GetOriginalCreatedDate(string documentId)
        {
            try
            {
                var document = await _searchClient.GetDocumentAsync<SearchDocument>(documentId);
                if (document?.Value?.TryGetValue("createdDate", out var createdDate) == true)
                {
                    if (createdDate is DateTimeOffset dto)
                        return dto;
                    if (DateTime.TryParse(createdDate?.ToString(), out var dt))
                        return new DateTimeOffset(dt);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Error getting original created date: {ex.Message}");
            }
            return DateTimeOffset.UtcNow;
        }

        private List<string> ChunkText(string text, int chunkSize, int overlap)
        {
            var chunks = new List<string>();
            if (string.IsNullOrWhiteSpace(text))
                return chunks;

            int start = 0;
            while (start < text.Length)
            {
                int end = Math.Min(start + chunkSize, text.Length);
                chunks.Add(text.Substring(start, end - start));
                start += chunkSize - overlap;
                
                if (start + overlap >= text.Length)
                    break;
            }
            
            return chunks;
        }

        private async Task ProcessIndexDocumentsInBatches(List<Dictionary<string, object>> searchDocuments, bool isDuplicate)
        {
            const int batchSize = 10; // Process in smaller batches to avoid request size limits
            
            for (int i = 0; i < searchDocuments.Count; i += batchSize)
            {
                var batch = searchDocuments.Skip(i).Take(batchSize).ToList();
                
                try
                {
                    var indexBatch = isDuplicate 
                        ? IndexDocumentsBatch.Merge(batch)
                        : IndexDocumentsBatch.Upload(batch);
                        
                    var indexResult = await _searchClient.IndexDocumentsAsync(indexBatch);
                    
                    var successCount = indexResult.Value.Results.Count(r => r.Succeeded);
                    var failureCount = indexResult.Value.Results.Count(r => !r.Succeeded);
                    
                    _logger.LogInformation($"Batch {i/batchSize + 1} indexed: {successCount} successes, {failureCount} failures");
                    
                    // Log any failures
                    foreach (var failure in indexResult.Value.Results.Where(r => !r.Succeeded))
                    {
                        _logger.LogError($"Chunk indexing failed: {failure.ErrorMessage}");
                    }
                    
                    // Add small delay between batches to avoid throttling
                    if (i + batchSize < searchDocuments.Count)
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
                            var singleBatch = isDuplicate 
                                ? IndexDocumentsBatch.Merge(new[] { doc })
                                : IndexDocumentsBatch.Upload(new[] { doc });
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

        private string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName)?.ToLower();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".doc" => "application/msword",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".ppt" => "application/vnd.ms-powerpoint",
                ".txt" => "text/plain",
                ".html" => "text/html",
                ".htm" => "text/html",
                ".xml" => "text/xml",
                ".json" => "application/json",
                ".png" => "image/png",
                ".jpg" => "image/jpeg",
                ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".tiff" => "image/tiff",
                ".tif" => "image/tiff",
                _ => "application/octet-stream"
            };
        }
    }

    public class UploadRequest
    {
        public string? FileName { get; set; }
        public string? FileContent { get; set; }
        public string? Department { get; set; }
        public string? DocumentType { get; set; }
        public string? SopType { get; set; }
        public string? Description { get; set; }
        public string? Version { get; set; }
        public string? Author { get; set; }
        public List<string>? Keywords { get; set; }
        public bool? FullTextExtraction { get; set; }
        public int? MaxTextLength { get; set; }
    }
}
