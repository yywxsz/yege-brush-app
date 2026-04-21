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
    const zip = await JSZip.loadAsync(buffer);

    // Main document content is in word/document.xml
    const documentXml = await zip.file('word/document.xml')?.async('string');

    if (!documentXml) {
      throw new Error('Invalid .docx file: word/document.xml not found');
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
