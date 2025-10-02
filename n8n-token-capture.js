// N8N Code Node: Capture Token Usage from Azure OpenAI Response
// Add this node AFTER your Azure OpenAI API call in your workflow

const openaiResponse = $input.first().json;

// Extract token usage from Azure OpenAI response
let tokenUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
};

// Check for token usage in the response
if (openaiResponse.usage) {
    tokenUsage = {
        prompt_tokens: openaiResponse.usage.prompt_tokens || 0,
        completion_tokens: openaiResponse.usage.completion_tokens || 0,
        total_tokens: openaiResponse.usage.total_tokens || 0
    };
}

// Calculate estimated cost (Azure OpenAI pricing for gpt-4.1-mini)
const inputCost = (tokenUsage.prompt_tokens / 1000) * 0.000015; // $0.000015 per 1K input tokens
const outputCost = (tokenUsage.completion_tokens / 1000) * 0.0003; // $0.0003 per 1K output tokens
const totalCost = inputCost + outputCost;

// Get the AI response text
const responseText = openaiResponse.choices?.[0]?.message?.content || 
                    openaiResponse.message?.content || 
                    openaiResponse.response || '';

// Build the complete response with token data
const finalResponse = {
    // Original response
    response: responseText,
    
    // Token usage data
    tokenUsage: {
        gpt_input_tokens: tokenUsage.prompt_tokens,
        gpt_output_tokens: tokenUsage.completion_tokens,
        total_tokens: tokenUsage.total_tokens,
        estimated_cost: totalCost,
        model: 'gpt-4.1-mini'
    },
    
    // Include any other data from the workflow
    audioBase64: $input.first().json.audioBase64 || null,
    audioData: $input.first().json.audioData || null,
    
    // Pass through any existing metadata
    ...($input.first().json)
};

// IMPORTANT: Return as array for n8n Code nodes
return [{
    json: finalResponse
}];