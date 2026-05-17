import { describe, it, expect } from 'vitest';
import {
  computeOverallRiskScore,
  riskScoreToBand,
  categoryBreakdown,
  severityRank,
} from '../risk.js';
import type { ClauseFinding } from '../types.js';

const finding = (over: Partial<ClauseFinding>): ClauseFinding => ({
  id: 'x',
  text: 'sample',
  span: [0, 6],
  category: 'one_sided',
  severity: 'high',
  riskScore: 70,
  confidence: 0.9,
  plainEnglish: 'p',
  recommendation: 'r',
  agent: 'risk_detection',
  ...over,
});

describe('computeOverallRiskScore', () => {
  it('returns 0 for no findings', () => {
    expect(computeOverallRiskScore([])).toBe(0);
  });

  it('a single critical drives a high overall score', () => {
    const s = computeOverallRiskScore([
      finding({ severity: 'critical', riskScore: 95, confidence: 0.95 }),
    ]);
    expect(s).toBeGreaterThanOrEqual(70);
  });

  it('many lows do not exceed one critical', () => {
    const lows = Array.from({ length: 12 }, () =>
      finding({ severity: 'low', riskScore: 25, confidence: 0.9 }),
    );
    const oneCrit = [finding({ severity: 'critical', riskScore: 92, confidence: 0.95 })];
    expect(computeOverallRiskScore(oneCrit)).toBeGreaterThan(
      computeOverallRiskScore(lows),
    );
  });

  it('caps at 100', () => {
    const f = Array.from({ length: 5 }, () =>
      finding({ severity: 'critical', riskScore: 100, confidence: 1 }),
    );
    expect(computeOverallRiskScore(f)).toBeLessThanOrEqual(100);
  });
});

describe('riskScoreToBand', () => {
  it.each([
    [10, 'safe'],
    [34, 'safe'],
    [35, 'caution'],
    [59, 'caution'],
    [60, 'high_risk'],
    [79, 'high_risk'],
    [80, 'dangerous'],
    [100, 'dangerous'],
  ])('score %i → %s', (score, band) => {
    expect(riskScoreToBand(score)).toBe(band);
  });
});

describe('categoryBreakdown', () => {
  it('counts findings per category', () => {
    const b = categoryBreakdown([
      finding({ category: 'arbitration_trap' }),
      finding({ category: 'arbitration_trap' }),
      finding({ category: 'auto_renewal' }),
    ]);
    expect(b.arbitration_trap).toBe(2);
    expect(b.auto_renewal).toBe(1);
    expect(b.dark_pattern).toBe(0);
  });
});

describe('severityRank', () => {
  it('ranks severities in order', () => {
    expect(severityRank('critical')).toBeGreaterThan(severityRank('high'));
    expect(severityRank('high')).toBeGreaterThan(severityRank('medium'));
    expect(severityRank('medium')).toBeGreaterThan(severityRank('low'));
    expect(severityRank('low')).toBeGreaterThan(severityRank('info'));
  });
});
