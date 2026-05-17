/**
 * Adapts the API's AnalysisResult shape (from @lexguard/shared) into the
 * local prop shape used by the LexGuardAnalysis design component.
 *
 * The design was built with seed data using its own narrower vocabulary
 * (predator / counsel / arbiter roles, 5 attack "vectors", 0-10 gauge).
 * This adapter keeps the design component data-agnostic by translating
 * the real domain types into the design's expected shape.
 */
import type {
  AnalysisResult,
  AgentDebateTurn,
  ClauseFinding,
  RiskCategory,
} from '@lexguard/shared';
import type {
  Finding,
  AgentTurn,
  AgentRole,
  Vector,
  Severity,
} from '@/components/lexguard-analysis';

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  exploitative: 'Exploitative',
  hidden_liability: 'Liability',
  legal_ambiguity: 'Ambiguity',
  one_sided: 'One-sided',
  financial_risk: 'Commercial',
  data_privacy: 'Privacy',
  auto_renewal: 'Term',
  cancellation_trap: 'Term',
  arbitration_trap: 'Disputes',
  indemnity: 'Liability',
  ip_assignment: 'IP',
  non_compete: 'Restrictive',
  jurisdiction: 'Disputes',
  limitation_of_liability: 'Liability',
  dark_pattern: 'UX dark pattern',
};

const SEVERITY_MAP: Record<string, Severity> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'low',
};

export function adaptFindings(real: ClauseFinding[]): Finding[] {
  return real.slice(0, 12).map((f, i) => {
    const title = firstSentence(f.plainEnglish) || prettify(f.category);
    return {
      id: f.id || `f${i + 1}`,
      section: extractSectionLabel(f.text, i),
      title: title.slice(0, 70),
      severity: SEVERITY_MAP[f.severity] ?? 'medium',
      excerpt: (f.text || f.plainEnglish || '').slice(0, 260),
      vector: CATEGORY_LABEL[f.category] ?? prettify(f.category),
      status: 'open',
    };
  });
}

/**
 * Map real debate turns to the design's three-role schema.
 * - user_advocate  → predator (argues from the user's offense)
 * - counterargument → counsel (defends the clause as standard)
 * - aggregator/sim  → arbiter (final ruling)
 * Always append a synthesized arbiter turn from the executive summary
 * so the debate column reads as a complete deliberation.
 */
export function adaptDebate(
  real: AgentDebateTurn[],
  executiveSummary: string,
  recommendedActions: string[],
): AgentTurn[] {
  const turns: AgentTurn[] = [];

  // Cap at 20 turns total — the debate runs 2 turns per finding (predator +
  // counsel) and we cap findings at 10 above, so 20 covers the common case.
  for (const [i, t] of real.slice(0, 20).entries()) {
    const role: AgentRole =
      t.agent === 'user_advocate' ? 'predator'
        : t.agent === 'counterargument' ? 'counsel'
          : 'arbiter';
    turns.push({
      id: `turn-${i}`,
      role,
      text: t.argument,
      verdict:
        role === 'predator' ? 'exploit'
          : role === 'counsel' ? 'fair'
            : 'amend',
    });
  }

  if (executiveSummary?.trim()) {
    turns.push({
      id: 'arbiter-summary',
      role: 'arbiter',
      text:
        executiveSummary +
        (recommendedActions[0] ? ` Recommended next step: ${recommendedActions[0]}` : ''),
      verdict: 'amend',
    });
  }

  return turns;
}

/**
 * Build the 5-vector exploitation breakdown from the real category counts.
 * Severity is assigned by binning the normalized count.
 */
export function adaptVectors(
  breakdown: Record<RiskCategory, number>,
  findings: ClauseFinding[],
): Vector[] {
  const grouped = new Map<string, { count: number; sumSev: number }>();
  for (const f of findings) {
    const label = CATEGORY_LABEL[f.category] ?? prettify(f.category);
    const sev = severityWeight(f.severity);
    const entry = grouped.get(label) ?? { count: 0, sumSev: 0 };
    entry.count += 1;
    entry.sumSev += sev;
    grouped.set(label, entry);
  }
  // Fall back to raw breakdown if grouping produced nothing
  if (grouped.size === 0) {
    for (const [cat, count] of Object.entries(breakdown)) {
      if (count > 0) {
        const label = CATEGORY_LABEL[cat as RiskCategory] ?? prettify(cat);
        grouped.set(label, { count, sumSev: count * 0.5 });
      }
    }
  }

  const totalCount = [...grouped.values()].reduce((a, b) => a + b.count, 0) || 1;
  const vectors: Vector[] = [...grouped.entries()].map(([label, { count, sumSev }]) => {
    const avgSev = sumSev / count;
    const score = Math.round(Math.min(100, (count / totalCount) * 60 + avgSev * 100 * 0.6));
    return { label, score, sev: bandFromScore(score) };
  });

  return vectors.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** Convert real 0-100 risk score to the design's 0-10 gauge. */
export function adaptGaugeScore(overallRiskScore: number): number {
  return Math.round((Math.max(0, Math.min(100, overallRiskScore)) / 10) * 10) / 10;
}

export interface AdaptedAnalysis {
  findings: Finding[];
  debate: AgentTurn[];
  vectors: Vector[];
  gaugeScore: number;
  riskBand: string;
}

export function adaptAnalysis(result: AnalysisResult): AdaptedAnalysis {
  return {
    findings: adaptFindings(result.findings),
    debate: adaptDebate(result.debate, result.executiveSummary, result.recommendedActions),
    vectors: adaptVectors(result.categoryBreakdown, result.findings),
    gaugeScore: adaptGaugeScore(result.overallRiskScore),
    riskBand: result.riskBand,
  };
}

/* ── helpers ─────────────────────────────────────────────────────────── */

function firstSentence(s: string): string {
  if (!s) return '';
  const m = s.match(/^[^.;!?]+[.;!?]?/);
  return (m?.[0] ?? s).trim();
}

function prettify(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Try to extract a real section label from the clause text — looks for
 * "Section 4", "Article XI", "§ 11.4", or a leading number like "4." or "(b)".
 * Falls back to "Clause N" (1-indexed, friendly to non-lawyers — no § symbol).
 */
function extractSectionLabel(text: string | undefined, idx: number): string {
  const fallback = `Clause ${idx + 1}`;
  if (!text) return fallback;
  const trimmed = text.trim().slice(0, 80);

  // Pattern A — "Section 4", "Article XI", "Clause 3" prefix
  const word = trimmed.match(
    /^(Section|Article|Clause|Paragraph|Sec\.?)\s+([A-Z0-9]+(?:\.[A-Z0-9]+)?)/i,
  );
  if (word?.[1] && word[2]) return `${capitalize(word[1])} ${word[2]}`;

  // Pattern B — "§ 11.4" or "§11.4" prefix
  const silcrow = trimmed.match(/^§\s*(\d+(?:\.\d+)?)/);
  if (silcrow?.[1]) return `Clause ${silcrow[1]}`;

  // Pattern C — leading "11.4" or "4." or "1)"
  const numbered = trimmed.match(/^(\d+(?:\.\d+)?)[.)]\s/);
  if (numbered?.[1]) return `Clause ${numbered[1]}`;

  // Pattern D — leading "(a)" or "(b)" style
  const lettered = trimmed.match(/^\(([a-zA-Z])\)\s/);
  if (lettered?.[1]) return `Item ${lettered[1].toUpperCase()}`;

  return fallback;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function severityWeight(sev: string): number {
  return ({ critical: 1.0, high: 0.75, medium: 0.45, low: 0.2, info: 0.05 }[sev] ?? 0.3);
}

function bandFromScore(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}
