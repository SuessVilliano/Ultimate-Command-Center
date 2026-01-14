/**
 * Content Ingestion Service
 *
 * Handles ingesting various content types into agent knowledge bases:
 * - URLs: Web scraping and content extraction
 * - Documents: PDF, Word, Excel, PowerPoint parsing
 * - Text: Direct text snippets
 * - Files: Images (OCR), CSVs, JSON, code files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ============================================
// URL CONTENT EXTRACTION
// ============================================

export async function extractUrlContent(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

    // Extract main content (simplified - strips HTML tags)
    let content = html
      // Remove script and style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    // Limit content length
    if (content.length > 50000) {
      content = content.substring(0, 50000) + '...';
    }

    // Generate summary (first 500 chars)
    const summary = content.substring(0, 500).trim() + (content.length > 500 ? '...' : '');

    return {
      type: 'url',
      title,
      content,
      summary,
      source_url: url,
      metadata: {
        contentType,
        fetchedAt: new Date().toISOString(),
        contentLength: content.length
      }
    };
  } catch (error) {
    throw new Error(`URL extraction failed: ${error.message}`);
  }
}

// ============================================
// DOCUMENT PARSING
// ============================================

export async function parseDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const fileName = path.basename(originalName);

  try {
    let content = '';
    let fileType = ext.substring(1);

    switch (ext) {
      case '.txt':
      case '.md':
      case '.markdown':
        content = fs.readFileSync(filePath, 'utf8');
        break;

      case '.json':
        const jsonContent = fs.readFileSync(filePath, 'utf8');
        content = JSON.stringify(JSON.parse(jsonContent), null, 2);
        break;

      case '.csv':
        content = fs.readFileSync(filePath, 'utf8');
        // Parse CSV to make it more readable
        const lines = content.split('\n');
        if (lines.length > 0) {
          const headers = lines[0];
          content = `CSV with headers: ${headers}\n\nFirst 50 rows:\n${lines.slice(0, 51).join('\n')}`;
        }
        break;

      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
      case '.py':
      case '.java':
      case '.c':
      case '.cpp':
      case '.go':
      case '.rs':
      case '.rb':
      case '.php':
      case '.swift':
      case '.kt':
        content = fs.readFileSync(filePath, 'utf8');
        fileType = 'code';
        break;

      case '.html':
      case '.htm':
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        content = htmlContent
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        break;

      case '.xml':
        content = fs.readFileSync(filePath, 'utf8');
        break;

      case '.pdf':
        // For PDF, we'll need to use an external service or library
        // For now, store a placeholder and the file path
        content = `[PDF Document: ${fileName}]\n\nNote: PDF content extraction requires additional processing. The file has been stored for reference.`;
        fileType = 'pdf';
        break;

      case '.doc':
      case '.docx':
        content = `[Word Document: ${fileName}]\n\nNote: Word document content extraction requires additional processing. The file has been stored for reference.`;
        fileType = 'word';
        break;

      case '.xls':
      case '.xlsx':
        content = `[Excel Spreadsheet: ${fileName}]\n\nNote: Excel content extraction requires additional processing. The file has been stored for reference.`;
        fileType = 'excel';
        break;

      case '.ppt':
      case '.pptx':
        content = `[PowerPoint Presentation: ${fileName}]\n\nNote: PowerPoint content extraction requires additional processing. The file has been stored for reference.`;
        fileType = 'powerpoint';
        break;

      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.webp':
      case '.bmp':
        content = `[Image File: ${fileName}]\n\nNote: Image content (OCR) extraction requires additional processing. The file has been stored for reference.`;
        fileType = 'image';
        break;

      default:
        // Try to read as text
        try {
          content = fs.readFileSync(filePath, 'utf8');
        } catch {
          content = `[Binary File: ${fileName}]\n\nThis file type cannot be read as text. The file has been stored for reference.`;
        }
    }

    // Limit content length
    if (content.length > 100000) {
      content = content.substring(0, 100000) + '\n\n[Content truncated due to length...]';
    }

    // Generate summary
    const summary = content.substring(0, 500).trim() + (content.length > 500 ? '...' : '');

    return {
      type: 'document',
      title: fileName,
      content,
      summary,
      file_path: filePath,
      file_type: fileType,
      metadata: {
        originalName: fileName,
        extension: ext,
        size: fs.statSync(filePath).size,
        uploadedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    throw new Error(`Document parsing failed: ${error.message}`);
  }
}

// ============================================
// TEXT SNIPPET HANDLING
// ============================================

export function processTextSnippet(title, content, metadata = {}) {
  const summary = content.substring(0, 500).trim() + (content.length > 500 ? '...' : '');

  return {
    type: 'text',
    title,
    content,
    summary,
    metadata: {
      ...metadata,
      addedAt: new Date().toISOString(),
      contentLength: content.length
    }
  };
}

// ============================================
// FILE UPLOAD HANDLING
// ============================================

export async function handleFileUpload(file, agentId) {
  // Generate unique filename
  const ext = path.extname(file.originalname);
  const uniqueName = `${agentId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  // Save file
  fs.writeFileSync(filePath, file.buffer);

  // Parse the document
  const parsed = await parseDocument(filePath, file.originalname);

  return {
    ...parsed,
    file_path: filePath
  };
}

// ============================================
// BATCH INGESTION
// ============================================

export async function batchIngestUrls(urls) {
  const results = [];

  for (const url of urls) {
    try {
      const content = await extractUrlContent(url);
      results.push({ success: true, url, content });
    } catch (error) {
      results.push({ success: false, url, error: error.message });
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

// ============================================
// AI-POWERED SUMMARIZATION
// ============================================

export async function generateSummaryWithAI(content, aiProvider) {
  if (!aiProvider) return null;

  try {
    const prompt = `Summarize the following content in 2-3 sentences, focusing on the key points and actionable information:\n\n${content.substring(0, 5000)}`;

    const response = await aiProvider.chat([{ role: 'user', content: prompt }], {
      maxTokens: 200
    });

    return response.text;
  } catch {
    return null;
  }
}

export default {
  extractUrlContent,
  parseDocument,
  processTextSnippet,
  handleFileUpload,
  batchIngestUrls,
  generateSummaryWithAI
};
