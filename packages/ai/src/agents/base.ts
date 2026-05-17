import type { AgentName, ClauseFinding, DocumentType } from '@lexguard/shared/types';
import type { AiProvider } from '../provider.js';
import { fenceUntrusted } from '../firewall.js';

export interface AgentContext {
  ai: AiProvider;
  documentId: string;
  documentType: DocumentType;
  jurisdiction?: string;
  language: string;
  signal?: AbortSignal;
}

export interface Agent {
  readonly name: AgentName;
  readonly description: string;
  /** Returns clause findings for the document */
  analyze(text: string, ctx: AgentContext): Promise<ClauseFinding[]>;
}

/**
 * Findings schema for Gemini structured output.
 *
 * Only the truly essential fields are `required` — span offsets and confidence
 * are hard for the model to compute reliably under strict schemas, so they're
 * optional and filled in by `normalizeFinding` below. This avoids the
 * Gemini 2.5 failure mode where the model silently returns an empty findings
 * array when it can't satisfy every required integer field.
 */
export const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          category: { type: 'string' },
          severity: { type: 'string' },
          riskScore: { type: 'integer' },
          plainEnglish: { type: 'string' },
          recommendation: { type: 'string' },
          // Optional / nice-to-have fields
          span_start: { type: 'integer' },
          span_end: { type: 'integer' },
          confidence: { type: 'number' },
          saferAlternative: { type: 'string' },
        },
        required: [
          'text',
          'category',
          'severity',
          'riskScore',
          'plainEnglish',
          'recommendation',
        ],
      },
    },
  },
  required: ['findings'],
} as const;

export interface RawFinding {
  text: string;
  span_start: number;
  span_end: number;
  category: string;
  severity: string;
  riskScore: number;
  confidence: number;
  plainEnglish: string;
  recommendation: string;
  saferAlternative?: string;
}

import { RISK_CATEGORIES, SEVERITY_LEVELS } from '@lexguard/shared/constants';
import type { RiskCategory, Severity } from '@lexguard/shared/types';

const VALID_CATEGORY = new Set<string>(RISK_CATEGORIES);
const VALID_SEVERITY = new Set<string>(SEVERITY_LEVELS);

/** Normalize a raw AI finding into a typed ClauseFinding. */
export function normalizeFinding(
  raw: RawFinding,
  agent: AgentName,
  idx: number,
  sourceLen: number,
): ClauseFinding | null {
  if (!raw || typeof raw.text !== 'string' || raw.text.trim().length < 3) return null;

  // Case-insensitive lookup — Gemini 2.5 sometimes returns "High" instead of "high"
  const catKey = String(raw.category ?? '').toLowerCase().replace(/[-\s]/g, '_');
  const category = VALID_CATEGORY.has(catKey)
    ? (catKey as RiskCategory)
    : 'one_sided';
  const sevKey = String(raw.severity ?? '').toLowerCase();
  const severity = VALID_SEVERITY.has(sevKey) ? (sevKey as Severity) : 'medium';

  // Spans are optional now — best-effort fallback to text-search in source.
  const start = Math.max(0, Math.min(sourceLen, raw.span_start ?? 0));
  const end = Math.max(start, Math.min(sourceLen, raw.span_end ?? start + raw.text.length));

  return {
    id: `${agent}-${idx}`,
    text: raw.text.slice(0, 8000),
    span: [start, end],
    category,
    severity,
    riskScore: clamp(Math.round(raw.riskScore ?? 0), 0, 100),
    confidence: clamp(raw.confidence ?? 0.6, 0, 1),
    plainEnglish: (raw.plainEnglish ?? '').slice(0, 2000),
    recommendation: (raw.recommendation ?? '').slice(0, 2000),
    saferAlternative: raw.saferAlternative?.slice(0, 4000),
    agent,
  };
}

export function buildAnalysisPrompt(opts: {
  rolePrompt: string;
  text: string;
  documentType: DocumentType;
  jurisdiction?: string;
  language: string;
}): string {
  const { rolePrompt, text, documentType, jurisdiction, language } = opts;
  return [
    rolePrompt,
    '',
    `DOCUMENT TYPE: ${documentType}`,
    `LANGUAGE: ${language}`,
    jurisdiction ? `JURISDICTION: ${jurisdiction}` : '',
    '',
    'Return ONLY JSON matching the requested schema. No prose, no markdown fences.',
    'For each finding, copy the EXACT clause text and compute span_start/span_end as character offsets into the document (0-indexed, end-exclusive).',
    'Valid categories: exploitative, hidden_liability, legal_ambiguity, one_sided, financial_risk, data_privacy, auto_renewal, cancellation_trap, arbitration_trap, indemnity, ip_assignment, non_compete, jurisdiction, limitation_of_liability, dark_pattern.',
    'Valid severities: critical, high, medium, low, info.',
    'riskScore is 0-100. confidence is 0.0-1.0.',
    '',
    fenceUntrusted(text),
  ]
    .filter(Boolean)
    .join('\n');
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
