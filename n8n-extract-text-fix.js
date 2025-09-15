// EXTRACT TEXT NODE FIX
// This extracts text from vision analysis without referencing non-existent nodes

const input = $json;
const allInputs = $input.all();

console.log('[Extract Text] Processing input');

let extractedText = '';
let visionAnalysis = '';
let ocrText = '';

// Try to get vision/OCR data from current input
if (input.visionAnalysis) {
  visionAnalysis = input.visionAnalysis;
} else if (input.imageAnalysis) {
  visionAnalysis = input.imageAnalysis;
}

if (input.extractedText) {
  extractedText = input.extractedText;
} else if (input.ocrText) {
  ocrText = input.ocrText;
}

// Try from all inputs
for (const item of allInputs) {
  const data = item.json || item;
  
  if (!visionAnalysis && (data.visionAnalysis || data.imageAnalysis)) {
    visionAnalysis = data.visionAnalysis || data.imageAnalysis;
  }
  
  if (!extractedText && (data.extractedText || data.ocrText)) {
    extractedText = data.extractedText || data.ocrText;
  }
  
  // Check for Computer Vision node output
  if (data.result && typeof data.result === 'string') {
    if (data.result.includes('text') || data.result.includes('content')) {
      visionAnalysis = data.result;
    }
  }
}

// Combine all extracted text
let combinedText = '';

if (extractedText) {
  combinedText += extractedText;
}

if (ocrText && ocrText !== extractedText) {
  if (combinedText) combinedText += '\n\n';
  combinedText += ocrText;
}

if (visionAnalysis) {
  if (combinedText) combinedText += '\n\nVision Analysis:\n';
  combinedText += visionAnalysis;
}

console.log('[Extract Text] Extracted text length:', combinedText.length);

// Return the extracted text
return [{
  json: {
    extractedText: combinedText,
    visionAnalysis: visionAnalysis,
    ocrText: ocrText || extractedText,
    hasText: !!combinedText,
    textLength: combinedText.length,
    timestamp: new Date().toISOString()
  }
}];