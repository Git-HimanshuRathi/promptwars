import { describe, it, expect } from 'vitest';
import { runUnifiedAnalysis } from '../agents/unified-analysis.js';
import type { AiProvider } from '../provider.js';

function mockProvider(payload: unknown): AiProvider {
  return {
    modelName: () => 'mock',
    stats: () => ({ calls: 0, activeKey: 0, cooledKeys: 0 }),
    async generate() {
      return JSON.stringify(payload);
    },
    async generateJson<T>(): Promise<T> {
      return payload as T;
    },
  };
}

describe('runUnifiedAnalysis', () => {
  it('normalizes findings + routes to correct agent based on category', async () => {
    const provider = mockProvider({
      findings: [
        {
          text: 'Customer indemnification obligations are uncapped.',
          category: 'data_privacy',
          severity: 'critical',
          riskScore: 95,
          plainEnglish: 'You take all the blame.',
          recommendation: 'Reject.',
        },
        {
          text: 'Vendor may unilaterally raise fees.',
          category: 'auto_renewal',
          severity: 'high',
          riskScore: 75,
          plainEnglish: 'They can change prices.',
          recommendation: 'Cap price increases.',
        },
        {
          text: 'In the company\'s sole discretion.',
          category: 'legal_ambiguity',
          severity: 'medium',
          riskScore: 50,
          plainEnglish: 'They decide later what this means.',
          recommendation: 'Define the term.',
        },
      ],
      executiveSummary: 'Heavily one-sided.',
      summary: 'Several traps.',
      recommendedActions: ['Negotiate caps', 'Define vague terms'],
    });

    const out = await runUnifiedAnalysis('original doc text', {
      ai: provider,
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });

    expect(out.findings).toHaveLength(3);
    expect(out.findings[0]!.agent).toBe('privacy');
    expect(out.findings[1]!.agent).toBe('financial');
    expect(out.findings[2]!.agent).toBe('ambiguity');
    expect(out.executiveSummary).toContain('one-sided');
    expect(out.recommendedActions).toHaveLength(2);
  });

  it('case-insensitive severity normalization (Gemini sometimes returns "High")', async () => {
    const provider = mockProvider({
      findings: [
        {
          text: 'A bad clause.',
          category: 'one_sided',
          severity: 'HIGH', // uppercase
          riskScore: 80,
          plainEnglish: 'Bad.',
          recommendation: 'Fix.',
        },
      ],
      executiveSummary: 'x',
      summary: 'x',
      recommendedActions: [],
    });

    const out = await runUnifiedAnalysis('text long enough to analyze', {
      ai: provider,
      documentId: 'd-1',
      documentType: 'other',
      language: 'en',
    });

    expect(out.findings[0]!.severity).toBe('high');
  });

  it('filters empty/junk findings and truncates oversized fields', async () => {
    const provider = mockProvider({
      findings: [
        { text: '', category: 'one_sided', severity: 'high', riskScore: 80, plainEnglish: 'x', recommendation: 'y' },
        { text: 'real clause here', category: 'one_sided', severity: 'critical', riskScore: 90, plainEnglish: 'x'.repeat(5000), recommendation: 'y'.repeat(5000) },
      ],
      executiveSummary: 'x'.repeat(10_000),
      summary: 'y'.repeat(10_000),
      recommendedActions: Array.from({ length: 50 }, () => 'z'.repeat(2000)),
    });

    const out = await runUnifiedAnalysis('text', {
      ai: provider,
      documentId: 'd-1',
      documentType: 'other',
      language: 'en',
    });

    expect(out.findings).toHaveLength(1); // empty text filtered
    expect(out.findings[0]!.plainEnglish.length).toBeLessThanOrEqual(2000);
    expect(out.executiveSummary.length).toBeLessThanOrEqual(4000);
    expect(out.summary.length).toBeLessThanOrEqual(4000);
    expect(out.recommendedActions.length).toBeLessThanOrEqual(20);
    expect(out.recommendedActions[0]!.length).toBeLessThanOrEqual(500);
  });
});
