using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Azure.AI.OpenAI;
using Azure;
using Microsoft.Extensions.Logging;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddEnvironmentVariables();
    })
    .ConfigureServices((context, services) =>
    {
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();

        var configuration = context.Configuration;

        // Register Blob Storage client
        services.AddSingleton(provider =>
        {
            var connectionString = configuration["BlobStorageConnectionString"];
            return new BlobServiceClient(connectionString);
        });

        // Register Azure AI Search client
        services.AddSingleton(provider =>
        {
            var searchServiceName = configuration["SearchServiceName"];
            var searchApiKey = configuration["SearchServiceKey"];
            var searchIndexName = configuration["AzureSearchIndexName"] ?? "sop-documents";
            var searchEndpoint = new Uri($"https://{searchServiceName}.search.windows.net");
            return new SearchClient(searchEndpoint, searchIndexName, new AzureKeyCredential(searchApiKey));
        });

        // Register Document Intelligence client
        services.AddSingleton(provider =>
        {
            var endpoint = configuration["DocumentIntelligenceEndpoint"];
            var apiKey = configuration["DocumentIntelligenceKey"];
            return new DocumentAnalysisClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
        });

        // Register OpenAI client
        services.AddSingleton(provider =>
        {
            var endpoint = configuration["OpenAIEndpoint"] ?? "https://eastus2.api.cognitive.microsoft.com/openai/";
            var apiKey = configuration["OpenAIKey"] ?? "5f91bb46df2a4769be8715d063f8757c";
            return new OpenAIClient(new Uri(endpoint), new AzureKeyCredential(apiKey));
        });

        // Add HttpClient for MegaMindChat proxy
        services.AddHttpClient();

        // Add logging
        services.AddLogging(builder =>
        {
            builder.AddConsole();
            builder.AddApplicationInsights();
        });
    })
    .Build();

host.Run();
