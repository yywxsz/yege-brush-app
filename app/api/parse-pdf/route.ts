import { NextRequest } from 'next/server';
import { parsePDF } from '@/lib/pdf/pdf-providers';
import { parseWord, isWordFile, isPdfFile } from '@/lib/pdf/word-parser';
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

    // Check file type and route accordingly
    if (isWordFile(file.name)) {
      // Handle Word document
      log.info(`Parsing Word document: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
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

    // Handle PDF (existing logic)
    if (!isPdfFile(file.name)) {
      return apiError(
        'UNSUPPORTED_FILE_TYPE',
        400,
        `Unsupported file type: ${file.name}. Please upload a PDF or Word document (.pdf, .docx, .doc)`,
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

    // Convert PDF to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF using the provider system
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
