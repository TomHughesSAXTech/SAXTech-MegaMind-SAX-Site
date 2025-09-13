// Enhanced Universal Document Processor for n8n
// Handles Excel, Word, PowerPoint, PDF, Images, and Text files with multiple fallback methods

const fileData = $input.first().json.attachments?.[0]?.data || '';
const fileName = $input.first().json.attachments?.[0]?.name || 'unknown';
const fileType = $input.first().json.attachments?.[0]?.type || '';

// Helper function to extract base64 content
function extractBase64Content(dataUrl) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return matches ? matches[2] : null;
}

// Helper function to decode base64
function decodeBase64(base64String) {
  try {
    return Buffer.from(base64String, 'base64');
  } catch (error) {
    console.error('Base64 decode error:', error);
    return null;
  }
}

// Excel file parser (without external dependencies)
function parseExcelBasic(buffer) {
  try {
    // Look for common Excel markers and extract readable text
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
    const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
    
    // Try to find worksheet data patterns
    const worksheetPattern = /<v>([^<]+)<\/v>/g;
    const cellValues = [];
    let match;
    while ((match = worksheetPattern.exec(text)) !== null) {
      cellValues.push(match[1]);
    }
    
    if (cellValues.length > 0) {
      return `Extracted cell values:\n${cellValues.join('\n')}`;
    }
    
    // Fallback to readable text extraction
    const lines = readableText.split(/\s{2,}/).filter(line => line.length > 3);
    return lines.length > 0 ? `Extracted text:\n${lines.join('\n')}` : 'Unable to extract readable content from Excel file';
  } catch (error) {
    return `Excel parsing error: ${error.message}`;
  }
}

// Word document parser (basic)
function parseWordBasic(buffer) {
  try {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
    
    // Look for Word document text patterns
    const docPattern = /<w:t[^>]*>([^<]+)<\/w:t>/g;
    const textContent = [];
    let match;
    while ((match = docPattern.exec(text)) !== null) {
      textContent.push(match[1]);
    }
    
    if (textContent.length > 0) {
      return `Document content:\n${textContent.join(' ')}`;
    }
    
    // Fallback to readable text extraction
    const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
    const lines = readableText.split(/\s{2,}/).filter(line => line.length > 5);
    return lines.length > 0 ? `Extracted text:\n${lines.join('\n')}` : 'Unable to extract readable content from Word document';
  } catch (error) {
    return `Word parsing error: ${error.message}`;
  }
}

// PowerPoint parser (basic)
function parsePowerPointBasic(buffer) {
  try {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
    
    // Look for PowerPoint text patterns
    const slidePattern = /<a:t>([^<]+)<\/a:t>/g;
    const slideContent = [];
    let match;
    while ((match = slidePattern.exec(text)) !== null) {
      slideContent.push(match[1]);
    }
    
    if (slideContent.length > 0) {
      return `Slide content:\n${slideContent.join('\n')}`;
    }
    
    // Fallback to readable text extraction
    const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
    return readableText.length > 10 ? `Extracted text:\n${readableText}` : 'Unable to extract content from PowerPoint';
  } catch (error) {
    return `PowerPoint parsing error: ${error.message}`;
  }
}

// CSV parser
function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const result = [];
  
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    if (lines[i].trim()) {
      result.push(lines[i]);
    }
  }
  
  return result.length > 0 ? result.join('\n') : 'Empty CSV file';
}

// Main processing logic
let extractedContent = '';
let processingMethod = 'unknown';

try {
  const base64Content = extractBase64Content(fileData);
  
  if (!base64Content) {
    return {
      fileName: fileName,
      fileType: fileType,
      content: 'Error: No valid base64 content found',
      method: 'error',
      success: false
    };
  }
  
  const buffer = decodeBase64(base64Content);
  
  if (!buffer) {
    return {
      fileName: fileName,
      fileType: fileType,
      content: 'Error: Failed to decode base64 content',
      method: 'error',
      success: false
    };
  }
  
  // Process based on file type
  if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    processingMethod = 'excel-basic-parser';
    extractedContent = parseExcelBasic(buffer);
    
    // If basic parsing doesn't work well, try as CSV
    if (extractedContent.includes('Unable to extract')) {
      processingMethod = 'excel-as-text';
      const textContent = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      extractedContent = parseCSV(textContent);
    }
  }
  else if (fileType.includes('word') || fileType.includes('document') || fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    processingMethod = 'word-basic-parser';
    extractedContent = parseWordBasic(buffer);
  }
  else if (fileType.includes('powerpoint') || fileType.includes('presentation') || fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
    processingMethod = 'powerpoint-basic-parser';
    extractedContent = parsePowerPointBasic(buffer);
  }
  else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
    processingMethod = 'csv-parser';
    const textContent = buffer.toString('utf-8');
    extractedContent = parseCSV(textContent);
  }
  else if (fileType.includes('text') || fileName.endsWith('.txt')) {
    processingMethod = 'text-direct';
    extractedContent = buffer.toString('utf-8');
  }
  else if (fileType.includes('pdf')) {
    processingMethod = 'pdf-notice';
    extractedContent = 'PDF files should be processed through Azure Document Intelligence API in a separate node';
  }
  else if (fileType.includes('image')) {
    processingMethod = 'image-ocr-notice';
    extractedContent = 'Image files should be processed through Azure Computer Vision OCR in a separate node';
  }
  else {
    // Unknown type - try to extract any readable text
    processingMethod = 'fallback-text-extraction';
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));
    const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
    extractedContent = readableText.length > 10 ? readableText : 'Unable to extract readable content from file';
  }
  
  // Clean up the extracted content
  if (extractedContent && extractedContent.length > 10000) {
    extractedContent = extractedContent.substring(0, 10000) + '\n\n[Content truncated to 10000 characters]';
  }
  
  return {
    fileName: fileName,
    fileType: fileType,
    content: extractedContent || 'No content could be extracted',
    method: processingMethod,
    success: extractedContent && extractedContent.length > 0 && !extractedContent.includes('Unable to extract'),
    fileSize: buffer.length
  };
  
} catch (error) {
  return {
    fileName: fileName,
    fileType: fileType,
    content: `Processing error: ${error.message}`,
    method: 'error',
    success: false,
    error: error.toString()
  };
}