import { createHash } from 'node:crypto';
import { SUPPORTED_MIME_TYPES, MAX_UPLOAD_BYTES } from '@lexguard/shared';

export interface ExtractedDocument {
  text: string;
  pages?: number;
  contentHash: string;
  detectedMime: string;
}

/**
 * Extract plain text from uploaded buffers. Supports PDF, DOCX, TXT, MD.
 * Throws on unsupported types or oversized inputs.
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ExtractedDocument> {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (${buffer.byteLength} bytes)`);
  }

  const normalizedMime = normalizeMime(mimeType, filename);
  if (!SUPPORTED_MIME_TYPES.includes(normalizedMime as never)) {
    throw new Error(`Unsupported file type: ${normalizedMime}`);
  }

  const contentHash = createHash('sha256').update(buffer).digest('hex');

  let text = '';
  let pages: number | undefined;

  switch (normalizedMime) {
    case 'application/pdf': {
      // pdf-parse is CJS; dynamic import keeps it lazy
      const { default: pdfParse } = await import('pdf-parse');
      validateMagic(buffer, [0x25, 0x50, 0x44, 0x46]); // %PDF
      const parsed = await pdfParse(buffer);
      text = parsed.text;
      pages = parsed.numpages;
      break;
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      // DOCX is a ZIP — magic PK\x03\x04
      validateMagic(buffer, [0x50, 0x4b, 0x03, 0x04]);
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
      break;
    }
    case 'application/msword': {
      throw new Error('Legacy .doc not supported; please re-save as .docx or PDF');
    }
    case 'text/plain':
    case 'text/markdown': {
      text = buffer.toString('utf-8');
      break;
    }
    default:
      throw new Error(`Unsupported mime: ${normalizedMime}`);
  }

  text = normalizeWhitespace(text);
  if (text.trim().length < 50) {
    throw new Error('Document is empty or contains no extractable text (try OCR for scans)');
  }

  return { text, pages, contentHash, detectedMime: normalizedMime };
}

function normalizeMime(mime: string, filename: string): string {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'md':
      return 'text/markdown';
    case 'txt':
      return 'text/plain';
    default:
      return mime;
  }
}

function validateMagic(buf: Buffer, expected: number[]): void {
  for (let i = 0; i < expected.length; i++) {
    if (buf[i] !== expected[i]) {
      throw new Error('Malformed file: magic bytes do not match declared type');
    }
  }
}

function normalizeWhitespace(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
