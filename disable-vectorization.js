// Temporary script to disable vectorization
// Add this to your document-upload.html or run it to disable vector generation

// Option 1: Disable in upload configuration
const disableVectorization = () => {
    // When uploading documents, exclude the content_vector field
    const uploadConfig = {
        skipVectorization: true,
        excludeFields: ['content_vector']
    };
    
    console.log('Vectorization disabled. Documents will upload without embeddings.');
    console.log('To re-enable, ensure Azure OpenAI is properly configured.');
    
    return uploadConfig;
};

// Option 2: Mock embeddings (for testing only)
const mockEmbeddings = () => {
    // Create a fake embedding array (1536 dimensions for ada-002)
    return new Array(1536).fill(0);
};

// Instructions:
console.log(`
=== DISABLE VECTORIZATION ===

To temporarily disable vectorization errors:

1. In your Azure Function that processes documents, add a check:
   if (skipVectorization || !openAIEndpoint) {
       // Skip embedding generation
       delete documentData.content_vector;
   }

2. Or update your document upload to exclude vector fields:
   const document = {
       id: docId,
       title: title,
       content: content,
       // Remove or comment out: content_vector: embeddings
   };

3. The search will still work with keyword/text search, just not vector similarity.
`);

module.exports = { disableVectorization, mockEmbeddings };