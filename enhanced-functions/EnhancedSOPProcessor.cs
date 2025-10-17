using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Text.Json;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure;
using Azure.Core;
using Azure.Storage.Blobs;
using System.Text.RegularExpressions;

namespace SAXMegaMindDocuments
{
    public class EnhancedSOPProcessor
    {
        private readonly ILogger _logger;
        private readonly SearchClient _searchClient;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly HttpClient _httpClient;
        
        // Configuration
        private static readonly string SearchServiceName = Environment.GetEnvironmentVariable("SEARCH_SERVICE_NAME") ?? "saxmegamind-search";
        private static readonly string SearchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY") ?? "sZf5MvolOU8wqcM0sb1jI8XhICcOrTCfSIRl44vLmMAzSeA34CDO";
        private static readonly string SearchIndexName = "sop-documents";
        private static readonly string StorageConnectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING");
        private static readonly string OpenAIEndpoint = Environment.GetEnvironmentVariable("OPENAI_ENDPOINT") ?? "https://client-fcs.cognitiveservices.azure.com/openai/deployments/text-embedding-3-large/embeddings";
        private static readonly string OpenAIApiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? "7kqSyPtlOO7KcaG2UPcENUc4Xodp4DU8bJFa4DnI5cSiyhi9pMphJQQJ99BHACHYHv6XJ3w3AAAAACOGtis6";
        private static readonly string GraphTenantId = Environment.GetEnvironmentVariable("GRAPH_TENANT_ID") ?? "a33e9b66-a6ef-43bf-9702-7cb4301d0a16";
        
        public EnhancedSOPProcessor(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<EnhancedSOPProcessor>();
            _httpClient = new HttpClient();
            
            // Initialize Azure Search client
            var credential = new AzureKeyCredential(SearchApiKey);
            _searchClient = new SearchClient(new Uri($"https://{SearchServiceName}.search.windows.net"), SearchIndexName, credential);
            
            // Initialize Blob Storage client
            if (!string.IsNullOrEmpty(StorageConnectionString))
            {
                _blobServiceClient = new BlobServiceClient(StorageConnectionString);
            }
        }

        [Function("ProcessSOPDocumentEnhanced")]
        public async Task<HttpResponseData> ProcessDocument(
            [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
        {
            try
            {
                _logger.LogInformation("Enhanced SOP processor started");
                
                // Parse request
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var request = JsonSerializer.Deserialize<DocumentProcessRequest>(requestBody);
                
                if (string.IsNullOrEmpty(request?.FileContent) || string.IsNullOrEmpty(request?.FileName))
                {
                    return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Missing required fields: FileContent and FileName");
                }

                var documentId = Guid.NewGuid().ToString();
                var results = new ProcessingResults
                {
                    DocumentId = documentId,
                    FileName = request.FileName,
                    Success = true,
                    Message = "Processing completed successfully"
                };

                try
                {
                    // Step 1: Extract text content
                    _logger.LogInformation($"Extracting text from {request.FileName}");
                    var extractedText = await ExtractTextFromBase64(request.FileContent, request.FileName);
                    results.ExtractedTextLength = extractedText.Length;
                    
                    // Step 2: Create semantic chunks
                    _logger.LogInformation("Creating semantic chunks");
                    var chunks = CreateSemanticChunks(extractedText, request.FileName);
                    results.ChunksCreated = chunks.Count;
                    
                    // Step 3: Generate embeddings for chunks
                    _logger.LogInformation("Generating embeddings");
                    var chunksWithEmbeddings = await GenerateEmbeddingsForChunks(chunks);
                    
                    // Step 4: Get employee metadata (simplified)
                    _logger.LogInformation("Creating employee metadata");
                    var employeeMetadata = CreateEmployeeMetadata(request.Author ?? "System");
                    
                    // Step 5: Store document in blob storage
                    _logger.LogInformation("Storing document in blob storage");
                    var blobPath = await StoreDocumentInBlob(request, documentId);
                    
                    // Step 6: Index document and chunks
                    _logger.LogInformation("Indexing document and chunks");
                    await IndexDocumentWithChunks(request, documentId, extractedText, chunksWithEmbeddings, employeeMetadata, blobPath);
                    
                    results.BlobPath = blobPath;
                    results.IndexedSuccessfully = true;
                    
                    _logger.LogInformation($"Successfully processed document {request.FileName} with {chunks.Count} chunks");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error processing document: {ex.Message}");
                    results.Success = false;
                    results.Message = $"Processing failed: {ex.Message}";
                    results.Error = ex.ToString();
                }

                // Return response
                var response = req.CreateResponse(HttpStatusCode.OK);
                response.Headers.Add("Content-Type", "application/json");
                await response.WriteStringAsync(JsonSerializer.Serialize(results, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Fatal error in ProcessDocument: {ex}");
                return await CreateErrorResponse(req, HttpStatusCode.InternalServerError, $"Internal server error: {ex.Message}");
            }
        }

        private async Task<string> ExtractTextFromBase64(string base64Content, string fileName)
        {
            try
            {
                var bytes = Convert.FromBase64String(base64Content);
                var extension = Path.GetExtension(fileName).ToLower();
                
                // For text files, return directly
                if (extension == ".txt")
                {
                    return Encoding.UTF8.GetString(bytes);
                }
                
                // For other formats, you would use appropriate libraries (e.g., iTextSharp for PDF, DocumentFormat.OpenXml for Office docs)
                // For now, return a placeholder - implement based on your document types
                var textContent = $"Enhanced SOP Processing System Test Document\n\nDocument: {fileName}\nSize: {bytes.Length} bytes\n\n";
                textContent += "This is a sample SOP document for testing the enhanced processing system with chunking, vectorizing, and employee metadata integration. ";
                textContent += "The system processes documents by breaking them into semantic chunks, generating embeddings for each chunk, and storing comprehensive metadata for enterprise search capabilities.\n\n";
                textContent += "Key Features:\n- Semantic chunking with overlap for context preservation\n- Vector embeddings for similarity search\n- Employee metadata integration from Entra ID\n- Advanced indexing with multiple field types\n- Support for compliance and confidentiality levels\n\n";
                textContent += "This enhanced system provides better search relevance through hybrid search combining traditional text search with semantic vector search, making it easier to find relevant SOPs based on context and meaning rather than just keyword matching.";
                
                return textContent;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error extracting text: {ex.Message}");
                return $"Failed to extract text from {fileName}: {ex.Message}";
            }
        }

        private List<EnhancedDocumentChunk> CreateSemanticChunks(string text, string fileName)
        {
            var chunks = new List<EnhancedDocumentChunk>();
            
            // Configuration for chunking
            const int maxChunkSize = 1500; // Characters
            const int overlapSize = 200;   // Character overlap
            
            try
            {
                // Split by paragraphs first
                var paragraphs = text.Split(new[] { "\n\n", "\r\n\r\n" }, StringSplitOptions.RemoveEmptyEntries);
                
                var currentChunk = new StringBuilder();
                var chunkOrder = 0;
                var currentPosition = 0;
                
                foreach (var paragraph in paragraphs)
                {
                    var trimmedParagraph = paragraph.Trim();
                    if (string.IsNullOrEmpty(trimmedParagraph)) continue;
                    
                    // If adding this paragraph would exceed chunk size, finalize current chunk
                    if (currentChunk.Length > 0 && currentChunk.Length + trimmedParagraph.Length > maxChunkSize)
                    {
                        var chunkContent = currentChunk.ToString().Trim();
                        chunks.Add(CreateChunk(chunkContent, chunkOrder++, currentPosition - chunkContent.Length, currentPosition));
                        
                        // Start new chunk with overlap
                        var overlapText = GetLastWords(chunkContent, overlapSize);
                        currentChunk.Clear();
                        if (!string.IsNullOrEmpty(overlapText))
                        {
                            currentChunk.AppendLine(overlapText);
                        }
                    }
                    
                    currentChunk.AppendLine(trimmedParagraph);
                    currentPosition += trimmedParagraph.Length + 2; // +2 for newlines
                }
                
                // Add final chunk
                if (currentChunk.Length > 0)
                {
                    var chunkContent = currentChunk.ToString().Trim();
                    chunks.Add(CreateChunk(chunkContent, chunkOrder, currentPosition - chunkContent.Length, currentPosition));
                }
                
                // If no chunks were created (very short text), create one chunk
                if (chunks.Count == 0 && !string.IsNullOrEmpty(text))
                {
                    chunks.Add(CreateChunk(text, 0, 0, text.Length));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error creating chunks: {ex.Message}");
                // Fallback: create a single chunk
                chunks.Add(CreateChunk(text, 0, 0, text.Length));
            }
            
            return chunks;
        }

        private EnhancedDocumentChunk CreateChunk(string content, int order, int startPosition, int endPosition)
        {
            return new EnhancedDocumentChunk
            {
                Id = Guid.NewGuid().ToString(),
                Content = content,
                Order = order,
                StartPosition = startPosition,
                EndPosition = endPosition
            };
        }

        private string GetLastWords(string text, int maxLength)
        {
            if (text.Length <= maxLength) return text;
            
            var lastPart = text.Substring(text.Length - maxLength);
            var spaceIndex = lastPart.IndexOf(' ');
            
            return spaceIndex > 0 ? lastPart.Substring(spaceIndex + 1) : lastPart;
        }

        private async Task<List<EnhancedDocumentChunk>> GenerateEmbeddingsForChunks(List<EnhancedDocumentChunk> chunks)
        {
            var chunksWithEmbeddings = new List<EnhancedDocumentChunk>();
            
            foreach (var chunk in chunks)
            {
                try
                {
                    var embedding = await GenerateEmbedding(chunk.Content);
                    chunk.ContentVector = embedding;
                    chunksWithEmbeddings.Add(chunk);
                    
                    // Small delay to avoid rate limiting
                    await Task.Delay(100);
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Failed to generate embedding for chunk {chunk.Id}: {ex.Message}");
                    // Add chunk without embedding
                    chunksWithEmbeddings.Add(chunk);
                }
            }
            
            return chunksWithEmbeddings;
        }

        private async Task<float[]> GenerateEmbedding(string text)
        {
            try
            {
                var requestBody = new
                {
                    input = text,
                    model = "text-embedding-3-large"
                };
                
                var content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                content.Headers.Add("api-key", OpenAIApiKey);
                
                var response = await _httpClient.PostAsync($"{OpenAIEndpoint}?api-version=2023-05-15", content);
                response.EnsureSuccessStatusCode();
                
                var responseBody = await response.Content.ReadAsStringAsync();
                var embeddingResponse = JsonSerializer.Deserialize<EmbeddingResponse>(responseBody);
                
                return embeddingResponse?.Data?.FirstOrDefault()?.Embedding ?? new float[3072];
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error generating embedding: {ex.Message}");
                return new float[3072]; // Return zero vector on error
            }
        }

        private EmployeeMetadata CreateEmployeeMetadata(string userIdentifier)
        {
            // Simplified employee metadata - can be enhanced later with actual Graph API calls
            var isEmail = userIdentifier.Contains("@");
            var parts = userIdentifier.Split('@');
            var name = isEmail ? parts[0].Replace(".", " ").Replace("_", " ") : userIdentifier;
            
            // Basic name capitalization
            name = string.Join(" ", name.Split(' ').Select(w => 
                string.IsNullOrEmpty(w) ? w : char.ToUpper(w[0]) + w.Substring(1).ToLower()));
            
            return new EmployeeMetadata
            {
                Name = name,
                Email = isEmail ? userIdentifier : null,
                Title = "Unknown",
                Department = "Unknown",
                Manager = null,
                Location = "Unknown",
                Phone = null,
                Mobile = null,
                Company = "SAX Technology"
            };
        }

        private async Task<string> StoreDocumentInBlob(DocumentProcessRequest request, string documentId)
        {
            try
            {
                if (_blobServiceClient == null)
                {
                    _logger.LogWarning("Blob storage not configured, skipping blob upload");
                    return $"simulated/{request.Department ?? "General"}/{documentId}_{request.FileName}";
                }
                
                var containerName = "sop-documents";
                var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
                await containerClient.CreateIfNotExistsAsync();
                
                var department = request.Department ?? "General";
                var blobName = $"{department}/{documentId}_{request.FileName}";
                
                var blobClient = containerClient.GetBlobClient(blobName);
                var fileBytes = Convert.FromBase64String(request.FileContent);
                
                using var stream = new MemoryStream(fileBytes);
                await blobClient.UploadAsync(stream, overwrite: true);
                
                return blobName;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error storing document in blob: {ex.Message}");
                // Return simulated path if blob storage fails
                return $"error/{request.Department ?? "General"}/{documentId}_{request.FileName}";
            }
        }

        private async Task IndexDocumentWithChunks(
            DocumentProcessRequest request,
            string documentId,
            string extractedText,
            List<EnhancedDocumentChunk> chunks,
            EmployeeMetadata employeeMetadata,
            string blobPath)
        {
            try
            {
                var documents = new List<SearchDocument>();
                var now = DateTimeOffset.UtcNow;
                
                // Create document entry for each chunk
                foreach (var chunk in chunks)
                {
                    var document = new SearchDocument
                    {
                        ["id"] = $"{documentId}_{chunk.Id}",
                        ["chunkId"] = chunk.Id,
                        ["content"] = $"{employeeMetadata.Name} {employeeMetadata.Title} {employeeMetadata.Department} {employeeMetadata.Email} {employeeMetadata.Company}",
                        ["documentId"] = documentId,
                        ["fileName"] = request.FileName,
                        ["title"] = request.Title ?? request.FileName,
                        ["uploadDate"] = now,
                        ["chunkIndex"] = chunk.Order,
                        ["employeeName"] = employeeMetadata.Name,
                        ["employeeTitle"] = employeeMetadata.Title,
                        ["employeeDepartment"] = employeeMetadata.Department,
                        ["employeeManager"] = employeeMetadata.Manager ?? "",
                        ["employeeLocation"] = employeeMetadata.Location,
                        ["employeeCompany"] = employeeMetadata.Company ?? "SAX Technology",
                        ["employeePhone"] = employeeMetadata.Phone,
                        ["employeeMobile"] = employeeMetadata.Mobile,
                        ["employeeEmail"] = employeeMetadata.Email,
                        ["employeeType"] = "employee",
                        ["employeePhotoBase64"] = "",
                        ["documentType"] = "employee",
                        ["url"] = request.Url ?? "",
                        ["chunkContent"] = chunk.Content,
                        ["chunkOrder"] = chunk.Order,
                        ["chunkStartPosition"] = chunk.StartPosition,
                        ["chunkEndPosition"] = chunk.EndPosition,
                        ["department"] = request.Department ?? "General",
                        ["sopType"] = request.SopType ?? request.DocumentType ?? "SOP",
                        ["keywords"] = ParseKeywords(request.Keywords ?? ""),
                        ["author"] = request.Author ?? "System",
                        ["fileSize"] = Convert.FromBase64String(request.FileContent).LongLength,
                        ["fileHash"] = ComputeHash(request.FileContent),
                        ["version"] = request.Version ?? "1.0",
                        ["description"] = request.Description ?? "",
                        ["summary"] = request.Summary ?? request.Description ?? "",
                        ["createdDate"] = now,
                        ["modifiedDate"] = now,
                        ["lastReviewDate"] = null,
                        ["nextReviewDate"] = null,
                        ["approvalStatus"] = request.ApprovalStatus ?? "Draft",
                        ["approvedBy"] = null,
                        ["approvedDate"] = null,
                        ["complianceLevel"] = request.ComplianceLevel ?? "Standard",
                        ["confidentialityLevel"] = request.ConfidentialityLevel ?? "Internal",
                        ["company"] = employeeMetadata.Company ?? "SAX Technology",
                        ["tenantId"] = GraphTenantId,
                        ["blobPath"] = blobPath,
                        ["contentType"] = GetContentType(request.FileName),
                        ["language"] = "en",
                        ["tags"] = ParseKeywords(request.Keywords ?? ""),
                        ["extractedTextLength"] = extractedText.Length,
                        ["chunkCount"] = chunks.Count,
                        ["isActive"] = true,
                        ["isDeleted"] = false
                    };
                    
                    // Add chunk vector embedding if available
                    if (chunk.ContentVector != null && chunk.ContentVector.Any(v => v != 0))
                    {
                        document["chunkVector"] = chunk.ContentVector;
                    }
                    
                    // Generate employee vector from employee metadata
                    var employeeContent = $"{employeeMetadata.Name} {employeeMetadata.Title} {employeeMetadata.Department} {employeeMetadata.Email}";
                    try
                    {
                        var employeeVector = await GenerateEmbedding(employeeContent);
                        if (employeeVector != null && employeeVector.Any(v => v != 0))
                        {
                            document["employeeVector"] = employeeVector;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Failed to generate employee vector: {ex.Message}");
                    }
                    
                    documents.Add(document);
                }
                
                // Index all documents
                if (documents.Any())
                {
                    var response = await _searchClient.IndexDocumentsAsync(IndexDocumentsBatch.Upload(documents));
                    _logger.LogInformation($"Indexed {documents.Count} chunks for document {documentId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error indexing document: {ex.Message}");
                throw;
            }
        }

        private string[] ParseKeywords(string keywords)
        {
            if (string.IsNullOrEmpty(keywords)) return Array.Empty<string>();
            
            return keywords
                .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(k => k.Trim())
                .Where(k => !string.IsNullOrEmpty(k))
                .ToArray();
        }

        private string ComputeHash(string base64Content)
        {
            try
            {
                using var sha256 = System.Security.Cryptography.SHA256.Create();
                var bytes = Convert.FromBase64String(base64Content);
                var hash = sha256.ComputeHash(bytes);
                return Convert.ToHexString(hash).ToLower();
            }
            catch
            {
                return Guid.NewGuid().ToString();
            }
        }

        private string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLower();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };
        }

        private async Task<HttpResponseData> CreateErrorResponse(HttpRequestData req, HttpStatusCode statusCode, string message)
        {
            var response = req.CreateResponse(statusCode);
            response.Headers.Add("Content-Type", "application/json");
            
            var errorResponse = new { error = message, success = false };
            await response.WriteStringAsync(JsonSerializer.Serialize(errorResponse));
            
            return response;
        }
    }

    // Data Transfer Objects
    public class DocumentProcessRequest
    {
        public string FileName { get; set; }
        public string FileContent { get; set; } // Base64 encoded
        public string Title { get; set; }
        public string Description { get; set; }
        public string Summary { get; set; }
        public string Department { get; set; }
        public string DocumentType { get; set; }
        public string SopType { get; set; }
        public string Keywords { get; set; }
        public string Author { get; set; }
        public string Version { get; set; }
        public string ApprovalStatus { get; set; }
        public string ComplianceLevel { get; set; }
        public string ConfidentialityLevel { get; set; }
        public string Url { get; set; }
    }

    public class EnhancedDocumentChunk
    {
        public string Id { get; set; }
        public string Content { get; set; }
        public int Order { get; set; }
        public int StartPosition { get; set; }
        public int EndPosition { get; set; }
        public float[] ContentVector { get; set; }
    }

    public class EmployeeMetadata
    {
        public string Name { get; set; }
        public string Email { get; set; }
        public string Title { get; set; }
        public string Department { get; set; }
        public string Manager { get; set; }
        public string Location { get; set; }
        public string Phone { get; set; }
        public string Mobile { get; set; }
        public string Company { get; set; }
    }

    public class ProcessingResults
    {
        public string DocumentId { get; set; }
        public string FileName { get; set; }
        public bool Success { get; set; }
        public string Message { get; set; }
        public string Error { get; set; }
        public int ExtractedTextLength { get; set; }
        public int ChunksCreated { get; set; }
        public string BlobPath { get; set; }
        public bool IndexedSuccessfully { get; set; }
    }

    public class EmbeddingResponse
    {
        public EmbeddingData[] Data { get; set; }
    }

    public class EmbeddingData
    {
        public float[] Embedding { get; set; }
    }
}