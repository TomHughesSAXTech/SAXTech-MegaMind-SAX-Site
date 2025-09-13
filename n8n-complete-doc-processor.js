// Complete Document Processor for n8n - Handles all file types and formats content for AI
// This version ensures content is properly extracted and passed to the AI

const inputJson = $input.first().json;
const sessionId = inputJson.sessionId || inputJson.session_id || inputJson.MESSAGE_METADATA?.sessionId || `session_${Date.now()}`;

// Get all attachments (support multiple files)
const attachments = inputJson.attachments || [];
const processedAttachments = [];
let allExtractedContent = [];

// Helper to extract base64 content
function extractBase64Content(dataUrl) {
  if (!dataUrl) return null;
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  return matches ? matches[2] : null;
}

// Helper to decode base64
function decodeBase64(base64String) {
  try {
    return Buffer.from(base64String, 'base64');
  } catch (error) {
    return null;
  }
}

// Extract text from Office XML files using regex patterns
function extractFromOfficeXML(buffer, fileType) {
  try {
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 500000));
    let extractedText = [];
    
    if (fileType.includes('word') || fileType.includes('document')) {
      // Extract from Word documents - look for text in w:t tags
      const patterns = [
        /<w:t[^>]*>([^<]+)<\/w:t>/g,
        /<w:t>([^<]+)<\/w:t>/g,
        /<t[^>]*>([^<]+)<\/t>/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const cleanText = match[1].trim();
          if (cleanText && cleanText.length > 1) {
            extractedText.push(cleanText);
          }
        }
      }
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet')) {
      // Extract from Excel - look for shared strings and cell values
      const patterns = [
        /<t>([^<]+)<\/t>/g,  // Shared strings
        /<v>([^<]+)<\/v>/g,  // Cell values
        /<si><t>([^<]+)<\/t><\/si>/g  // String items
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const cleanText = match[1].trim();
          if (cleanText && cleanText.length > 0) {
            extractedText.push(cleanText);
          }
        }
      }
    } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
      // Extract from PowerPoint - look for text in a:t tags
      const patterns = [
        /<a:t>([^<]+)<\/a:t>/g,
        /<p:txBody[^>]*>.*?<a:t>([^<]+)<\/a:t>.*?<\/p:txBody>/g
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const cleanText = match[1].trim();
          if (cleanText && cleanText.length > 1) {
            extractedText.push(cleanText);
          }
        }
      }
    }
    
    // If no text found with XML patterns, try general text extraction
    if (extractedText.length === 0) {
      const generalPattern = />([^<]{2,})</g;
      let match;
      while ((match = generalPattern.exec(text)) !== null) {
        const cleanText = match[1].trim();
        if (cleanText && 
            cleanText.length > 2 && 
            !cleanText.match(/^[\d\s]+$/) &&  // Not just numbers/spaces
            !cleanText.includes('xmlns') &&    // Not XML namespace
            !cleanText.includes('xml:') &&     // Not XML attributes
            !cleanText.includes('w:') &&       // Not Word namespaces
            !cleanText.includes('r:')) {       // Not relationship IDs
          extractedText.push(cleanText);
        }
      }
    }
    
    // Remove duplicates and clean up
    const uniqueText = [...new Set(extractedText)];
    
    // Join with proper spacing
    return uniqueText.length > 0 ? uniqueText.join(' ') : null;
    
  } catch (error) {
    return null;
  }
}

// Process text files
function processTextFile(buffer) {
  try {
    return buffer.toString('utf-8');
  } catch (error) {
    return 'Unable to read text file';
  }
}

// Process CSV files
function processCSV(buffer) {
  try {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.slice(0, 200).join('\n');  // Limit to 200 lines
  } catch (error) {
    return 'Unable to read CSV file';
  }
}

// Main processing for each attachment
for (const attachment of attachments) {
  const fileName = attachment.name || 'unknown';
  const fileType = attachment.type || '';
  const fileData = attachment.data || '';
  
  let extractedContent = '';
  let processingMethod = 'unknown';
  let success = false;
  
  try {
    const base64Content = extractBase64Content(fileData);
    
    if (!base64Content) {
      extractedContent = 'Error: Invalid file data';
      processingMethod = 'error';
    } else {
      const buffer = decodeBase64(base64Content);
      
      if (!buffer) {
        extractedContent = 'Error: Could not decode file';
        processingMethod = 'error';
      } else {
        // Process based on file type
        if (fileType.includes('text') || fileName.endsWith('.txt')) {
          processingMethod = 'text';
          extractedContent = processTextFile(buffer);
          success = true;
        } 
        else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
          processingMethod = 'csv';
          extractedContent = processCSV(buffer);
          success = true;
        }
        else if (fileType.includes('word') || 
                 fileType.includes('document') || 
                 fileName.match(/\.docx?$/i)) {
          processingMethod = 'word-xml';
          extractedContent = extractFromOfficeXML(buffer, 'word');
          if (!extractedContent) {
            // Fallback: try to extract any readable text
            const text = buffer.toString('utf-8', 0, 100000);
            const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                                 .replace(/\s+/g, ' ')
                                 .trim();
            extractedContent = readable.length > 10 ? readable : 'Unable to extract Word document content';
          } else {
            success = true;
          }
        }
        else if (fileType.includes('excel') || 
                 fileType.includes('spreadsheet') || 
                 fileName.match(/\.xlsx?$/i)) {
          processingMethod = 'excel-xml';
          extractedContent = extractFromOfficeXML(buffer, 'excel');
          if (!extractedContent) {
            // Fallback: try CSV-style extraction
            const text = buffer.toString('utf-8', 0, 100000);
            const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                                 .replace(/\s+/g, ' ')
                                 .trim();
            extractedContent = readable.length > 10 ? readable : 'Unable to extract Excel content';
          } else {
            success = true;
          }
        }
        else if (fileType.includes('powerpoint') || 
                 fileType.includes('presentation') || 
                 fileName.match(/\.pptx?$/i)) {
          processingMethod = 'powerpoint-xml';
          extractedContent = extractFromOfficeXML(buffer, 'powerpoint');
          if (!extractedContent) {
            extractedContent = 'Unable to extract PowerPoint content';
          } else {
            success = true;
          }
        }
        else if (fileType.includes('pdf')) {
          processingMethod = 'pdf-unsupported';
          extractedContent = '[PDF file - requires OCR processing]';
        }
        else if (fileType.includes('image')) {
          processingMethod = 'image-unsupported';
          extractedContent = '[Image file - requires OCR processing]';
        }
        else {
          // Unknown type - try generic extraction
          processingMethod = 'generic';
          const text = buffer.toString('utf-8', 0, 50000);
          const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
                               .replace(/\s+/g, ' ')
                               .trim();
          extractedContent = readable.length > 10 ? readable : 'Unable to extract file content';
        }
      }
    }
    
    // Truncate if too long
    if (extractedContent && extractedContent.length > 15000) {
      extractedContent = extractedContent.substring(0, 15000) + '\n\n[Content truncated...]';
    }
    
  } catch (error) {
    extractedContent = `Processing error: ${error.message}`;
    processingMethod = 'error';
  }
  
  // Store processed attachment info
  const processedAttachment = {
    fileName: fileName,
    fileType: fileType,
    method: processingMethod,
    success: success,
    contentLength: extractedContent.length
  };
  
  processedAttachments.push(processedAttachment);
  
  // Add to extracted content for AI
  if (extractedContent && extractedContent.length > 0 && !extractedContent.includes('Error:')) {
    allExtractedContent.push(`\n\n━━━ ${fileName} ━━━\n${extractedContent}\n━━━━━━━━━━━━━━━━━━━━━━\n`);
  }
}

// Format the final message for the AI
let messageForAI = inputJson.MESSAGE_SENT || inputJson.message || '';

// Add extracted content to the message
if (allExtractedContent.length > 0) {
  messageForAI = `${messageForAI}\n\n📎 **Attached Files Content:**\n${allExtractedContent.join('\n')}\n\n**Please acknowledge and analyze the attached file content above.**`;
}

// Build attachment summary for the user
const attachmentSummary = processedAttachments.map(att => {
  if (att.success) {
    return `✅ ${att.fileName} (${att.method}, ${att.contentLength} chars extracted)`;
  } else {
    return `⚠️ ${att.fileName} (${att.method})`;
  }
});

// Return complete data structure
return {
  ...inputJson,  // Preserve all original fields
  sessionId: sessionId,  // Ensure sessionId is present
  
  // Message with embedded content for AI
  MESSAGE_WITH_ATTACHMENTS: messageForAI,
  
  // Attachment processing details
  attachmentProcessing: {
    count: processedAttachments.length,
    files: processedAttachments,
    summary: attachmentSummary,
    totalExtractedLength: allExtractedContent.join('').length
  },
  
  // Raw extracted content (if needed separately)
  extractedContent: allExtractedContent.join('\n'),
  
  // Flag to indicate attachments were processed
  hasProcessedAttachments: allExtractedContent.length > 0
};