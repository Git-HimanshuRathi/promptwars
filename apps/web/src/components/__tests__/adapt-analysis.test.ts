import { describe, it, expect } from 'vitest';
import {
  adaptAnalysis,
  adaptFindings,
  adaptDebate,
  adaptVectors,
  adaptGaugeScore,
} from '@/lib/adapt-analysis';
import type {
  AnalysisResult,
  AgentDebateTurn,
  ClauseFinding,
} from '@lexguard/shared';

const finding = (over: Partial<ClauseFinding> = {}): ClauseFinding => ({
  id: 'f1',
  text: 'You hereby waive your right to participate in any class action.',
  span: [0, 60],
  category: 'arbitration_trap',
  severity: 'high',
  riskScore: 78,
  confidence: 0.92,
  plainEnglish: 'You give up class action rights. Big deal for users.',
  recommendation: 'Negotiate to preserve class action rights.',
  agent: 'risk_detection',
  ...over,
});

describe('adaptFindings', () => {
  it('maps real findings to the design shape', () => {
    const out = adaptFindings([finding(), finding({ id: 'f2', severity: 'critical' })]);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toBe('f1');
    expect(out[0]!.severity).toBe('high');
    expect(out[0]!.status).toBe('open');
    expect(out[0]!.vector).toBe('Disputes');
    expect(out[1]!.severity).toBe('critical');
  });

  it('coerces info severity to low', () => {
    const out = adaptFindings([finding({ severity: 'info' as 'high' })]);
    expect(out[0]!.severity).toBe('low');
  });

  it('truncates oversized titles', () => {
    const long = 'a'.repeat(500);
    const out = adaptFindings([finding({ plainEnglish: long })]);
    expect(out[0]!.title.length).toBeLessThanOrEqual(70);
  });
});

describe('adaptDebate', () => {
  const turns: AgentDebateTurn[] = [
    { agent: 'user_advocate', argument: 'This is harmful.', agrees: true, confidence: 0.9 },
    { agent: 'counterargument', argument: 'It is standard.', agrees: false, confidence: 0.5 },
  ];

  it('maps user_advocate → predator and counterargument → counsel', () => {
    const out = adaptDebate(turns, 'Document is high risk.', ['Negotiate § 11']);
    expect(out[0]!.role).toBe('predator');
    expect(out[1]!.role).toBe('counsel');
  });

  it('appends an arbiter summary turn', () => {
    const out = adaptDebate(turns, 'Document is high risk.', ['Negotiate § 11']);
    const last = out[out.length - 1]!;
    expect(last.role).toBe('arbiter');
    expect(last.text).toContain('high risk');
    expect(last.text).toContain('Negotiate § 11');
  });

  it('omits arbiter turn when no executive summary is present', () => {
    const out = adaptDebate(turns, '', []);
    expect(out.every((t) => t.role !== 'arbiter')).toBe(true);
  });
});

describe('adaptVectors', () => {
  it('groups findings into category-labeled vectors with severity bands', () => {
    const out = adaptVectors(
      { arbitration_trap: 2, auto_renewal: 1 } as never,
      [
        finding({ category: 'arbitration_trap', severity: 'critical' }),
        finding({ category: 'arbitration_trap', severity: 'high' }),
        finding({ category: 'auto_renewal', severity: 'medium' }),
      ],
    );
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out[0]!.label).toBe('Disputes'); // arbitration_trap maps to Disputes
    expect(out[0]!.score).toBeGreaterThan(out[1]!.score);
  });

  it('falls back to raw breakdown when findings are empty', () => {
    const out = adaptVectors({ dark_pattern: 4, indemnity: 2 } as never, []);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('adaptGaugeScore', () => {
  it.each([
    [0, 0],
    [50, 5],
    [73, 7.3],
    [100, 10],
    [150, 10], // clamped
    [-10, 0], // clamped
  ])('%i → %s', (input, expected) => {
    expect(adaptGaugeScore(input)).toBe(expected);
  });
});

describe('adaptAnalysis (end-to-end)', () => {
  it('returns a complete adapted payload', () => {
    const result: AnalysisResult = {
      documentId: '11111111-1111-4111-8111-111111111111',
      documentType: 'contract',
      overallRiskScore: 78,
      riskBand: 'high_risk',
      summary: 'A risky contract.',
      executiveSummary: 'Many clauses favor the vendor.',
      findings: [finding(), finding({ id: 'f2', severity: 'critical', category: 'indemnity' })],
      debate: [
        { agent: 'user_advocate', argument: 'Bad clause.', agrees: true, confidence: 0.9 },
      ],
      recommendedActions: ['Renegotiate § 11.4'],
      categoryBreakdown: { arbitration_trap: 1, indemnity: 1 } as never,
      modelUsed: 'gemini-1.5-pro',
      durationMs: 42_000,
      createdAt: new Date().toISOString(),
    };

    const out = adaptAnalysis(result);
    expect(out.findings).toHaveLength(2);
    expect(out.gaugeScore).toBe(7.8);
    expect(out.riskBand).toBe('high_risk');
    expect(out.vectors.length).toBeGreaterThan(0);
    expect(out.debate.length).toBeGreaterThan(0);
  });
});
