import type { AnalysisResult, ClauseFinding, RiskCategory, Severity } from './types.js';
import { RISK_CATEGORIES } from './constants.js';

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.45,
  low: 0.2,
  info: 0.05,
};

/**
 * Aggregate clause findings into a single overall risk score (0-100).
 * Uses confidence-weighted severity with a sub-linear penalty so a document
 * with many low-severity findings does not exceed one with a single critical.
 */
export function computeOverallRiskScore(findings: ClauseFinding[]): number {
  if (findings.length === 0) return 0;

  let weighted = 0;
  let weightSum = 0;
  let maxSingle = 0;

  for (const f of findings) {
    const sev = SEVERITY_WEIGHTS[f.severity] ?? 0.3;
    const w = sev * f.confidence;
    weighted += f.riskScore * w;
    weightSum += w;
    maxSingle = Math.max(maxSingle, f.riskScore * sev);
  }

  const avg = weightSum > 0 ? weighted / weightSum : 0;
  // Blend: 60% weighted average, 40% worst-case
  const score = 0.6 * avg + 0.4 * maxSingle;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function riskScoreToBand(score: number): AnalysisResult['riskBand'] {
  if (score >= 80) return 'dangerous';
  if (score >= 60) return 'high_risk';
  if (score >= 35) return 'caution';
  return 'safe';
}

export function categoryBreakdown(
  findings: ClauseFinding[],
): Record<RiskCategory, number> {
  const out = Object.fromEntries(RISK_CATEGORIES.map((c) => [c, 0])) as Record<
    RiskCategory,
    number
  >;
  for (const f of findings) {
    out[f.category] = (out[f.category] ?? 0) + 1;
  }
  return out;
}

/** Severity rank used for sorting; higher = more severe */
export function severityRank(sev: Severity): number {
  return { info: 0, low: 1, medium: 2, high: 3, critical: 4 }[sev];
}
