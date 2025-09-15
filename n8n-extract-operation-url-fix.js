// EXTRACT OPERATION URL FIX
// Extracts the operation URL from Azure Document Intelligence response

const input = $json;
const allInputs = $input.all();

console.log('[Extract Operation URL] Processing response');

// Extract operation URL from headers
let operationUrl = null;

// Check current input
if (input.headers && input.headers['operation-location']) {
    operationUrl = input.headers['operation-location'];
    console.log('[Extract Operation URL] Found in headers:', operationUrl);
}

// Check all inputs if not found
if (!operationUrl) {
    for (const item of allInputs) {
        if (item.json?.headers?.['operation-location']) {
            operationUrl = item.json.headers['operation-location'];
            console.log('[Extract Operation URL] Found in input headers:', operationUrl);
            break;
        }
    }
}

// Verify we got a valid URL
if (!operationUrl) {
    throw new Error('No operation-location header found in response');
}

// Extract the operation ID from the URL
const operationIdMatch = operationUrl.match(/analyzeResults\/([a-f0-9-]+)/);
const operationId = operationIdMatch ? operationIdMatch[1] : null;

console.log('[Extract Operation URL] Operation ID:', operationId);

// Return the extracted data
return [{
    json: {
        operationUrl: operationUrl,
        operationId: operationId,
        statusCode: input.statusCode || 202,
        statusMessage: input.statusMessage || 'Accepted',
        timestamp: new Date().toISOString()
    }
}];