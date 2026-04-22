import { NextRequest } from 'next/server';
import { parsePDF } from '@/lib/pdf/pdf-providers';
import { parseWord, isWordFile, isPdfFile, detectFileType } from '@/lib/pdf/word-parser';
import { resolvePDFApiKey, resolvePDFBaseUrl } from '@/lib/server/provider-config';
import type { PDFProviderId } from '@/lib/pdf/types';
import type { ParsedPdfContent } from '@/lib/types/pdf';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
const log = createLogger('Parse Document');

export async function POST(req: NextRequest) {
  let fileName: string | undefined;
  let resolvedProviderId: string | undefined;
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      log.error('Invalid Content-Type for document upload:', contentType);
      return apiError(
        'INVALID_REQUEST',
        400,
        `Invalid Content-Type: expected multipart/form-data, got "${contentType}"`,
      );
    }

    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const providerId = formData.get('providerId') as PDFProviderId | null;
    const apiKey = formData.get('apiKey') as string | null;
    const baseUrl = formData.get('baseUrl') as string | null;

    if (!file) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'No file provided');
    }

    fileName = file.name;

    // Read file content for type detection
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Detect actual file type by magic bytes (more reliable than extension)
    const actualType = detectFileType(buffer);
    const extensionType = isPdfFile(file.name) ? 'pdf' : (isWordFile(file.name) ? 'word' : 'unknown');
    
    log.info(`File: ${file.name}, Extension type: ${extensionType}, Actual type: ${actualType}`);
    
    // Warn if extension doesn't match actual content
    if (actualType === 'pdf' && isWordFile(file.name)) {
      log.warn(`File "${file.name}" has Word extension but is actually a PDF`);
    } else if ((actualType === 'doc' || actualType === 'docx') && isPdfFile(file.name)) {
      log.warn(`File "${file.name}" has PDF extension but is actually a Word document`);
    }

    // Route based on ACTUAL file type, not extension
    if (actualType === 'doc' || actualType === 'docx' || (actualType === 'unknown' && isWordFile(file.name))) {
      // Handle Word document
      log.info(`Parsing Word document: ${file.name} (detected as ${actualType})`);
      const result = await parseWord(buffer);

      const resultWithMetadata: ParsedPdfContent = {
        text: result.text,
        images: [], // Word documents don't have embedded images in this implementation
        metadata: {
          pageCount: 1,
          fileName: file.name,
          fileSize: file.size,
          wordCount: result.metadata.wordCount,
        },
      };

      return apiSuccess({ data: resultWithMetadata });
    }

    // Handle PDF
    if (actualType !== 'pdf' && actualType !== 'unknown') {
      return apiError(
        'UNSUPPORTED_FILE_TYPE',
        400,
        `检测到文件实际类型与扩展名不符。\n\n` +
        `文件名: ${file.name}\n` +
        `扩展名: ${extensionType}\n` +
        `实际类型: ${actualType}\n\n` +
        `请确认文件格式正确，或将文件转换为 PDF 后上传。`
      );
    }
    
    if (!isPdfFile(file.name) && actualType !== 'pdf') {
      return apiError(
        'UNSUPPORTED_FILE_TYPE',
        400,
        `Unsupported file type: ${file.name}. Please upload a PDF or Word document (.pdf, .docx)`,
      );
    }

    // providerId is required from the client — no server-side store to fall back to
    const effectiveProviderId = providerId || ('unpdf' as PDFProviderId);
    resolvedProviderId = effectiveProviderId;

    const clientBaseUrl = baseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = await validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const config = {
      providerId: effectiveProviderId,
      apiKey: clientBaseUrl
        ? apiKey || ''
        : resolvePDFApiKey(effectiveProviderId, apiKey || undefined),
      baseUrl: clientBaseUrl
        ? clientBaseUrl
        : resolvePDFBaseUrl(effectiveProviderId, baseUrl || undefined),
    };

    // Parse PDF using the provider system (buffer already read above)
    const result = await parsePDF(config, buffer);

    // Add file metadata
    const resultWithMetadata: ParsedPdfContent = {
      ...result,
      metadata: {
        ...result.metadata,
        pageCount: result.metadata?.pageCount ?? 0, // Ensure pageCount is always a number
        fileName: file.name,
        fileSize: file.size,
      },
    };

    return apiSuccess({ data: resultWithMetadata });
  } catch (error) {
    log.error(
      `Document parsing failed [provider=${resolvedProviderId ?? 'word'}, file="${fileName ?? 'unknown'}"]:`,
      error,
    );
    return apiError('PARSE_FAILED', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}
