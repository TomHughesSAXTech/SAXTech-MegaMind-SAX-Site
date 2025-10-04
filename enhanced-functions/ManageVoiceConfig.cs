using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using System.Net;
using System.Text.Json;
using System.Text;
using Newtonsoft.Json;

namespace SAXMegaMindDocuments
{
    public class ManageVoiceConfig
    {
        private readonly ILogger<ManageVoiceConfig> _logger;
        private readonly BlobServiceClient _blobServiceClient;
        private const string VoiceConfigContainer = "voice-config";
        private const string VoiceConfigBlobName = "voice-settings.json";

        public ManageVoiceConfig(ILogger<ManageVoiceConfig> logger, BlobServiceClient blobServiceClient)
        {
            _logger = logger;
            _blobServiceClient = blobServiceClient;
        }

        [Function("ManageVoiceConfig")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post")] HttpRequestData req)
        {
            _logger.LogInformation("Processing voice configuration request");

            try
            {
                if (req.Method.Equals("GET", StringComparison.OrdinalIgnoreCase))
                {
                    return await GetVoiceConfig(req);
                }
                else if (req.Method.Equals("POST", StringComparison.OrdinalIgnoreCase))
                {
                    return await UpdateVoiceConfig(req);
                }
                else
                {
                    var methodNotAllowedResponse = req.CreateResponse(HttpStatusCode.MethodNotAllowed);
                    await methodNotAllowedResponse.WriteStringAsync("Only GET and POST methods are allowed");
                    return methodNotAllowedResponse;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error in voice config management: {ex.Message}", ex);
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Voice config error: {ex.Message}");
                return errorResponse;
            }
        }

        private async Task<HttpResponseData> GetVoiceConfig(HttpRequestData req)
        {
            try
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(VoiceConfigContainer);
                var blobClient = containerClient.GetBlobClient(VoiceConfigBlobName);

                if (!await blobClient.ExistsAsync())
                {
                    // Return default configuration if none exists
                    var defaultConfig = GetDefaultVoiceConfig();
                    var response = req.CreateResponse(HttpStatusCode.OK);
                    await response.WriteAsJsonAsync(defaultConfig);
                    return response;
                }

                var downloadResult = await blobClient.DownloadContentAsync();
                var configJson = downloadResult.Value.Content.ToString();
                var voiceConfig = JsonConvert.DeserializeObject<VoiceConfiguration>(configJson);

                var successResponse = req.CreateResponse(HttpStatusCode.OK);
                await successResponse.WriteAsJsonAsync(voiceConfig);
                return successResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error retrieving voice config: {ex.Message}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Failed to retrieve voice configuration: {ex.Message}");
                return errorResponse;
            }
        }

        private async Task<HttpResponseData> UpdateVoiceConfig(HttpRequestData req)
        {
            try
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var voiceConfig = JsonConvert.DeserializeObject<VoiceConfiguration>(requestBody);

                if (voiceConfig == null)
                {
                    var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badResponse.WriteStringAsync("Invalid voice configuration data");
                    return badResponse;
                }

                // Validate the configuration
                var validationResult = ValidateVoiceConfig(voiceConfig);
                if (!validationResult.IsValid)
                {
                    var validationResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await validationResponse.WriteStringAsync($"Validation failed: {validationResult.ErrorMessage}");
                    return validationResponse;
                }

                // Update timestamps
                voiceConfig.LastModified = DateTime.UtcNow;
                if (voiceConfig.CreatedDate == DateTime.MinValue)
                {
                    voiceConfig.CreatedDate = DateTime.UtcNow;
                }

                // Save to blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(VoiceConfigContainer);
                await containerClient.CreateIfNotExistsAsync();
                
                var blobClient = containerClient.GetBlobClient(VoiceConfigBlobName);
                var configJson = JsonConvert.SerializeObject(voiceConfig, Formatting.Indented);
                
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(configJson)))
                {
                    await blobClient.UploadAsync(stream, overwrite: true);
                }

                _logger.LogInformation("Voice configuration updated successfully");

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = "Voice configuration updated successfully",
                    lastModified = voiceConfig.LastModified,
                    voiceProvider = voiceConfig.VoiceProvider,
                    voiceModel = voiceConfig.VoiceModel
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating voice config: {ex.Message}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Failed to update voice configuration: {ex.Message}");
                return errorResponse;
            }
        }

        private VoiceConfiguration GetDefaultVoiceConfig()
        {
            return new VoiceConfiguration
            {
                Id = Guid.NewGuid().ToString(),
                VoiceProvider = "ElevenLabs",
                VoiceModel = "eleven_turbo_v2_5",
                VoiceId = "21m00Tcm4TlvDq8ikWAM",
                VoiceName = "Rachel",
                Speed = 1.0f,
                Stability = 0.5f,
                SimilarityBoost = 0.8f,
                Style = 0.0f,
                UseSpeakerBoost = true,
                OptimizeStreamingLatency = 2,
                OutputFormat = "mp3_44100_128",
                Language = "en",
                CreatedDate = DateTime.UtcNow,
                LastModified = DateTime.UtcNow,
                IsActive = true,
                MaxTextLength = 2500,
                SupportedLanguages = new List<string> { "en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko" },
                CustomSettings = new Dictionary<string, object>
                {
                    ["background_music"] = false,
                    ["pronunciation_dictionary"] = new Dictionary<string, string>(),
                    ["voice_enhancement"] = true
                }
            };
        }

        private ValidationResult ValidateVoiceConfig(VoiceConfiguration config)
        {
            if (string.IsNullOrEmpty(config.VoiceProvider))
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Voice provider is required" };
            }

            if (string.IsNullOrEmpty(config.VoiceModel))
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Voice model is required" };
            }

            if (string.IsNullOrEmpty(config.VoiceId))
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Voice ID is required" };
            }

            if (config.Speed < 0.25f || config.Speed > 4.0f)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Speed must be between 0.25 and 4.0" };
            }

            if (config.Stability < 0.0f || config.Stability > 1.0f)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Stability must be between 0.0 and 1.0" };
            }

            if (config.SimilarityBoost < 0.0f || config.SimilarityBoost > 1.0f)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Similarity boost must be between 0.0 and 1.0" };
            }

            if (config.Style < 0.0f || config.Style > 1.0f)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Style must be between 0.0 and 1.0" };
            }

            if (config.OptimizeStreamingLatency < 0 || config.OptimizeStreamingLatency > 4)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Optimize streaming latency must be between 0 and 4" };
            }

            if (config.MaxTextLength < 1 || config.MaxTextLength > 5000)
            {
                return new ValidationResult { IsValid = false, ErrorMessage = "Max text length must be between 1 and 5000" };
            }

            var validFormats = new[] { "mp3_22050_32", "mp3_44100_32", "mp3_44100_64", "mp3_44100_96", "mp3_44100_128", "mp3_44100_192", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100", "ulaw_8000" };
            if (!validFormats.Contains(config.OutputFormat))
            {
                return new ValidationResult { IsValid = false, ErrorMessage = $"Invalid output format. Valid formats: {string.Join(", ", validFormats)}" };
            }

            return new ValidationResult { IsValid = true };
        }
    }

    public class VoiceConfiguration
    {
        public string Id { get; set; } = string.Empty;
        public string VoiceProvider { get; set; } = string.Empty;
        public string VoiceModel { get; set; } = string.Empty;
        public string VoiceId { get; set; } = string.Empty;
        public string VoiceName { get; set; } = string.Empty;
        public float Speed { get; set; } = 1.0f;
        public float Stability { get; set; } = 0.5f;
        public float SimilarityBoost { get; set; } = 0.8f;
        public float Style { get; set; } = 0.0f;
        public bool UseSpeakerBoost { get; set; } = true;
        public int OptimizeStreamingLatency { get; set; } = 2;
        public string OutputFormat { get; set; } = "mp3_44100_128";
        public string Language { get; set; } = "en";
        public DateTime CreatedDate { get; set; }
        public DateTime LastModified { get; set; }
        public bool IsActive { get; set; } = true;
        public int MaxTextLength { get; set; } = 2500;
        public List<string> SupportedLanguages { get; set; } = new();
        public Dictionary<string, object> CustomSettings { get; set; } = new();
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public string ErrorMessage { get; set; } = string.Empty;
    }
}