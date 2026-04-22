/**
 * Word document (.docx) parser
 * Extracts text content from .docx files using JSZip
 */

import JSZip from 'jszip';
import { createLogger } from '@/lib/logger';

const log = createLogger('ParseWord');

export interface ParsedWordContent {
  text: string;
  metadata: {
    fileName?: string;
    fileSize?: number;
    wordCount: number;
  };
}

/**
 * Parse a .docx file and extract text content
 * .docx is a ZIP archive containing XML files
 */
export async function parseWord(buffer: Buffer): Promise<ParsedWordContent> {
  try {
    // Check if this might be an old .doc format (binary, not ZIP)
    // Old .doc files start with D0 CF 11 E0 (OLE2 signature)
    const header = buffer.slice(0, 4);
    const isOle2 = header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;
    
    if (isOle2) {
      throw new Error(
        '旧版 .doc 格式不支持。请将文件另存为 .docx 格式（Word 2007+），或转换为 PDF 后上传。\n\n' +
        'Old .doc format is not supported. Please save as .docx format (Word 2007+) or convert to PDF.'
      );
    }

    const zip = await JSZip.loadAsync(buffer);

    // Main document content is in word/document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      // List available files for debugging
      const files = Object.keys(zip.files);
      log.error('Invalid .docx structure. Available files:', files.slice(0, 10));
      
      throw new Error(
        '无效的 .docx 文件结构。请确认文件是有效的 Word 文档。\n\n' +
        '可能的原因：\n' +
        '1. 文件已损坏\n' +
        '2. 文件不是真正的 .docx 格式\n' +
        '3. 文件是其他格式（如 .doc, .txt）被重命名为 .docx\n\n' +
        '建议：请用 Word 打开文件，另存为 .docx 格式后重试。'
      );
    }

    // Extract text from XML
    const text = extractTextFromXml(documentXml);

    // Clean up text
    const cleanedText = text
      .replace(/\s+/g, ' ')
      .trim();

    return {
      text: cleanedText,
      metadata: {
        wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
      },
    };
  } catch (error) {
    log.error('Failed to parse Word document:', error);
    throw new Error(
      `Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract text content from Word document XML
 */
function extractTextFromXml(xml: string): string {
  const textParts: string[] = [];

  // Match all <w:t> elements (text runs)
  // Also handle <w:tab> for tab characters and <w:br> for line breaks
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const tabRegex = /<w:tab\/>/g;
  const breakRegex = /<w:br[^>]*\/>/g;

  // Replace tabs and breaks first
  let processedXml = xml
    .replace(tabRegex, '\t')
    .replace(breakRegex, '\n');

  // Extract text content
  let match;
  while ((match = textRegex.exec(processedXml)) !== null) {
    if (match[1]) {
      textParts.push(match[1]);
    }
  }

  // Join with spaces, but preserve paragraph breaks
  // Check for paragraph markers
  const paragraphRegex = /<\/w:p>/g;
  let result = processedXml;

  // Extract paragraphs
  const paragraphs: string[] = [];
  const paragraphParts = result.split('</w:p>');

  for (const para of paragraphParts) {
    const paraTexts: string[] = [];
    let textMatch;
    const localTextRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    while ((textMatch = localTextRegex.exec(para)) !== null) {
      if (textMatch[1]) {
        paraTexts.push(textMatch[1]);
      }
    }
    if (paraTexts.length > 0) {
      paragraphs.push(paraTexts.join(''));
    }
  }

  return paragraphs.join('\n\n');
}

/**
 * Check if a file is a Word document based on extension
 */
export function isWordFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'docx' || ext === 'doc';
}

/**
 * Check if a file is a PDF based on extension
 */
export function isPdfFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'pdf';
}

/**
 * Detect actual file type by checking file header (magic bytes)
 * More reliable than extension-based detection
 */
export function detectFileType(buffer: Buffer): 'pdf' | 'docx' | 'doc' | 'unknown' {
  // PDF files start with %PDF
  if (buffer.length >= 5) {
    const header = buffer.slice(0, 5).toString('ascii');
    if (header === '%PDF-') {
      return 'pdf';
    }
  }
  
  // Old .doc files start with D0 CF 11 E0 (OLE2 signature)
  if (buffer.length >= 4) {
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      return 'doc';
    }
  }
  
  // .docx files are ZIP archives starting with PK (50 4B)
  if (buffer.length >= 4) {
    if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
      // Could be .docx or other ZIP - check for word/document.xml
      // For now, assume it's docx if extension matches
      return 'docx';
    }
  }
  
  return 'unknown';
}
