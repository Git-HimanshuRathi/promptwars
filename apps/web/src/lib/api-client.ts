import type { AnalysisProgressEvent, AnalysisResult } from '@lexguard/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AnalyzeTextArgs {
  text: string;
  documentType?: string;
  jurisdiction?: string;
  signal?: AbortSignal;
}

export interface UploadEnvelope {
  documentId: string;
  result: AnalysisResult;
  extractedText?: string;
}

export async function analyzeText(args: AnalyzeTextArgs): Promise<UploadEnvelope> {
  const res = await fetch(`${API_URL}/api/analyze-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: args.text,
      documentType: args.documentType ?? 'other',
      jurisdiction: args.jurisdiction,
    }),
    signal: args.signal,
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

export async function uploadDocument(
  file: File,
  opts: { documentType?: string; jurisdiction?: string; signal?: AbortSignal } = {},
): Promise<UploadEnvelope> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('documentType', opts.documentType ?? 'other');
  if (opts.jurisdiction) fd.append('jurisdiction', opts.jurisdiction);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: fd,
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

/**
 * Stream analysis progress via Server-Sent Events.
 * Uses fetch + ReadableStream to support POST + custom headers.
 */
export async function streamAnalysis(
  args: AnalyzeTextArgs,
  onEvent: (e: AnalysisProgressEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/analyze/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: args.text,
      documentType: args.documentType ?? 'other',
      jurisdiction: args.jurisdiction,
    }),
    signal: args.signal,
  });
  if (!res.ok || !res.body) throw new Error(await safeError(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as AnalysisProgressEvent);
      } catch {
        /* ignore */
      }
    }
  }
}

async function safeError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}
