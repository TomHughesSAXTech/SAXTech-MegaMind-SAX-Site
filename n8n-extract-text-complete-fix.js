// EXTRACT TEXT COMPLETE FIX - Properly extracts text from Computer Vision output
// This handles the Azure Computer Vision API response format

const input = $json;
const allInputs = $input.all();

console.log('[Extract Text] Processing vision data');

let extractedText = '';
let visionDescription = '';
let allExtractedLines = [];

// Check if this is Computer Vision output
if (input.readResult && input.readResult.blocks) {
  console.log('[Extract Text] Found Computer Vision readResult');
  
  // Extract all text from blocks
  for (const block of input.readResult.blocks) {
    if (block.lines) {
      for (const line of block.lines) {
        if (line.text) {
          allExtractedLines.push(line.text);
        }
      }
    }
  }
  
  extractedText = allExtractedLines.join(' ');
  console.log('[Extract Text] Extracted OCR text:', extractedText);
}

// Get image caption/description
if (input.captionResult && input.captionResult.text) {
  visionDescription = input.captionResult.text;
  console.log('[Extract Text] Vision description:', visionDescription);
}

// Also check dense captions for additional context
let denseCaptions = [];
if (input.denseCaptionsResult && input.denseCaptionsResult.values) {
  for (const caption of input.denseCaptionsResult.values) {
    if (caption.text && caption.confidence > 0.7) {
      denseCaptions.push(caption.text);
    }
  }
}

// Get tags
let tags = [];
if (input.tagsResult && input.tagsResult.values) {
  tags = input.tagsResult.values
    .filter(tag => tag.confidence > 0.8)
    .map(tag => tag.name);
}

// Build comprehensive output
let fullAnalysis = '';

// Add the main extracted text
if (extractedText) {
  fullAnalysis = `Text in image: "${extractedText}"`;
}

// Add description if different from extracted text
if (visionDescription && !extractedText.includes(visionDescription)) {
  if (fullAnalysis) fullAnalysis += '\n\n';
  fullAnalysis += `Image description: ${visionDescription}`;
}

// Add tags for context
if (tags.length > 0) {
  if (fullAnalysis) fullAnalysis += '\n\n';
  fullAnalysis += `Image contains: ${tags.join(', ')}`;
}

console.log('[Extract Text] Full analysis length:', fullAnalysis.length);

// Return the properly extracted data
return [{
  json: {
    extractedText: extractedText || '',
    visionAnalysis: fullAnalysis || visionDescription || '',
    ocrText: extractedText || '',
    imageDescription: visionDescription || '',
    denseCaptions: denseCaptions,
    tags: tags,
    hasText: !!extractedText,
    textLength: extractedText.length,
    fullContext: fullAnalysis,
    timestamp: new Date().toISOString(),
    debug: {
      foundReadResult: !!(input.readResult && input.readResult.blocks),
      linesFound: allExtractedLines.length,
      extractedLines: allExtractedLines
    }
  }
}];