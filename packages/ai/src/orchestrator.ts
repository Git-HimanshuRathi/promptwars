import type {
  AnalysisProgressEvent,
  AnalysisResult,
  ClauseFinding,
  DocumentType,
} from '@lexguard/shared/types';
import {
  categoryBreakdown,
  computeOverallRiskScore,
  riskScoreToBand,
  severityRank,
} from '@lexguard/shared/risk';
import { MAX_DOC_CHARS, MAX_CLAUSES_PER_DOC } from '@lexguard/shared/constants';
import type { AiProvider } from './provider.js';
import { scanAndSanitize } from './firewall.js';
import type { AgentContext } from './agents/base.js';
import { runUnifiedAnalysis } from './agents/unified-analysis.js';
import { runUnifiedDebate } from './agents/unified-debate.js';

export interface AnalyzeOptions {
  documentId: string;
  documentType?: DocumentType;
  jurisdiction?: string;
  language?: string;
  signal?: AbortSignal;
  /** Stream progress events */
  onProgress?: (e: AnalysisProgressEvent) => void;
  /**
   * Skip the adversarial debate step. Saves one Gemini call when you don't
   * need confidence-weighted score adjustments or the debate panel.
   */
  skipDebate?: boolean;
}

/**
 * Run the full LEXGUARD analysis pipeline.
 *
 * Costs exactly **2 Gemini calls per analysis** in the default mode:
 *
 *   1. Unified analysis  — finds all clauses across the 4 specialist categories
 *      and writes summary + recommended actions in one structured-output call.
 *
 *   2. Unified debate    — produces user_advocate (predator) + counterargument
 *      (counsel) turns for every finding in one call. Strong counter-arguments
 *      lower the original risk scores.
 *
 * If `skipDebate` is true OR the analysis returned 0 findings, step 2 is
 * skipped and the total cost is **1 Gemini call**.
 *
 * Previously this pipeline used 7 separate calls; the consolidation lets a
 * free-tier Gemini key handle 750 analyses/day instead of ~200.
 */
export async function analyzeDocument(
  ai: AiProvider,
  rawText: string,
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const onProgress = opts.onProgress ?? (() => {});

  // ─ Step 1 ─ Sanitize input + log any injection attempts
  onProgress({ type: 'started', message: 'Sanitizing input', progress: 0.05 });
  const fw = scanAndSanitize(rawText);
  const trimmed = fw.sanitized.slice(0, MAX_DOC_CHARS);
  if (fw.hits.length > 0) {
    onProgress({
      type: 'agent',
      agent: 'risk_detection',
      message: `Prompt-injection patterns detected (${fw.hits.length}). Treating as untrusted data.`,
    });
  }

  const ctx: AgentContext = {
    ai,
    documentId: opts.documentId,
    documentType: opts.documentType ?? 'other',
    jurisdiction: opts.jurisdiction,
    language: opts.language ?? 'en',
    signal: opts.signal,
  };

  // ─ Step 2 ─ Unified analysis (1 Gemini call)
  onProgress({
    type: 'agent',
    agent: 'risk_detection',
    message: 'Running unified clause-finding analysis…',
    progress: 0.2,
  });

  let unified;
  try {
    unified = await runUnifiedAnalysis(trimmed, ctx);
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    onProgress({ type: 'error', error: `Analysis failed: ${msg.slice(0, 240)}` });
    throw err;
  }

  let findings = dedupeByOverlap(unified.findings).slice(0, MAX_CLAUSES_PER_DOC);

  onProgress({
    type: 'agent',
    agent: 'aggregator',
    message: `Merged ${findings.length} unique findings`,
    progress: 0.6,
  });

  // ─ Step 3 ─ Adversarial debate (1 Gemini call, optional)
  let debate: AnalysisResult['debate'] = [];
  if (!opts.skipDebate && findings.length > 0) {
    onProgress({
      type: 'agent',
      agent: 'user_advocate',
      message: 'Running adversarial debate (predator + counsel)…',
      progress: 0.75,
    });
    try {
      const { debate: turns, adjustments } = await runUnifiedDebate(findings, ctx);
      debate = turns;
      if (adjustments.size > 0) {
        findings = findings.map((f) => {
          const delta = adjustments.get(f.id);
          if (!delta) return f;
          return { ...f, riskScore: Math.max(0, Math.min(100, f.riskScore + delta)) };
        });
      }
    } catch (err) {
      // Debate is best-effort — if it 429s, we still ship the analysis.
       
      console.error('[lexguard] debate failed, continuing:', (err as Error)?.message);
    }
  }

  // ─ Step 4 ─ Sort + assemble result
  findings.sort(
    (a, b) =>
      severityRank(b.severity) - severityRank(a.severity) || b.riskScore - a.riskScore,
  );

  const overallRiskScore = computeOverallRiskScore(findings);
  const result: AnalysisResult = {
    documentId: opts.documentId,
    documentType: ctx.documentType,
    overallRiskScore,
    riskBand: riskScoreToBand(overallRiskScore),
    summary: unified.summary || synthesizeFallbackSummary(findings),
    executiveSummary:
      unified.executiveSummary || synthesizeFallbackSummary(findings).slice(0, 280),
    findings,
    debate,
    recommendedActions: unified.recommendedActions,
    categoryBreakdown: categoryBreakdown(findings),
    modelUsed: ai.modelName(),
    durationMs: Date.now() - startedAt,
    createdAt: new Date().toISOString(),
  };

  onProgress({ type: 'completed', progress: 1, partial: result });
  return result;
}

/**
 * Merge findings that target the same span (within 20-char overlap).
 * Keeps the highest-severity / highest-risk finding.
 */
function dedupeByOverlap(findings: ClauseFinding[]): ClauseFinding[] {
  const sorted = [...findings].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.riskScore - a.riskScore,
  );
  const kept: ClauseFinding[] = [];

  for (const f of sorted) {
    const overlap = kept.find((k) => spansOverlap(k.span, f.span, 20));
    if (overlap) continue;
    kept.push(f);
  }
  return kept;
}

function spansOverlap(
  a: [number, number],
  b: [number, number],
  slack: number,
): boolean {
  const [a1, a2] = a;
  const [b1, b2] = b;
  return a1 - slack <= b2 && b1 - slack <= a2;
}

function synthesizeFallbackSummary(findings: ClauseFinding[]): string {
  if (findings.length === 0) {
    return 'No material risks were detected in this document.';
  }
  const crit = findings.filter((f) => f.severity === 'critical').length;
  const high = findings.filter((f) => f.severity === 'high').length;
  return `Identified ${findings.length} risk findings (${crit} critical, ${high} high). Top concern: ${findings[0]?.plainEnglish ?? 'see full report'}.`;
}
