import { describe, it, expect } from 'vitest';
import { analyzeDocument } from '../orchestrator.js';
import type { AiProvider } from '../provider.js';

/**
 * Mock provider for the unified-call orchestrator (2 Gemini calls per doc):
 *  1) unified-analysis → returns findings + summary + actions
 *  2) unified-debate   → returns predator + counsel turns
 */
function mockProvider(opts: { withFindings?: boolean } = {}): AiProvider {
  const withFindings = opts.withFindings ?? true;
  return {
    modelName: () => 'mock-gemini',
    async generate() {
      return '{}';
    },
    stats: () => ({ calls: 0, activeKey: 0, cooledKeys: 0 }),
    async generateJson<T>(prompt: string): Promise<T> {
      // Debate prompt (mentions "PREDATOR", "COUNSEL", or "moderate")
      if (/PREDATOR|COUNSEL|moderate LEXGUARD/i.test(prompt)) {
        return {
          turns: [
            {
              role: 'predator',
              findingId: 'risk_detection-0',
              argument: 'This is genuinely harmful to the user.',
              agrees: true,
              confidence: 0.85,
            },
            {
              role: 'counsel',
              findingId: 'risk_detection-0',
              argument: 'Standard boilerplate.',
              agrees: false,
              confidence: 0.4, // Below 0.7 threshold — no adjustment
            },
          ],
        } as T;
      }
      // Unified analysis prompt (the only other call)
      return {
        findings: withFindings
          ? [
              {
                text: 'unilateral right to modify',
                category: 'one_sided',
                severity: 'high',
                riskScore: 82,
                plainEnglish: 'Company can change the terms at any time.',
                recommendation: 'Negotiate notice + opt-out.',
              },
            ]
          : [],
        executiveSummary: 'High-risk contract with several exploitative clauses.',
        summary: 'Detailed summary of the agreement.',
        recommendedActions: ['Negotiate clause 1', 'Reject clause 2'],
      } as T;
    },
  };
}

describe('analyzeDocument', () => {
  it('runs the full pipeline and returns a valid result', async () => {
    const text =
      'Company reserves the unilateral right to modify these terms at any time without notice. ' +
      'User waives the right to participate in any class action. ' +
      'All disputes shall be resolved by binding arbitration in Delaware.';

    const result = await analyzeDocument(mockProvider(), text, {
      documentId: '11111111-1111-4111-8111-111111111111',
      documentType: 'tos',
    });

    expect(result.documentId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.overallRiskScore).toBeGreaterThan(0);
    expect(['safe', 'caution', 'high_risk', 'dangerous']).toContain(result.riskBand);
    expect(result.executiveSummary).toBeTruthy();
    expect(result.debate.length).toBeGreaterThan(0);
    expect(result.modelUsed).toBe('mock-gemini');
  });

  it('emits progress events', async () => {
    const events: string[] = [];
    await analyzeDocument(mockProvider(), 'Sample legal text long enough to analyze. '.repeat(5), {
      documentId: '22222222-2222-4222-8222-222222222222',
      onProgress: (e) => events.push(e.type),
    });
    expect(events[0]).toBe('started');
    expect(events).toContain('completed');
  });

  it('skips debate when no findings, keeping call count to 1', async () => {
    const result = await analyzeDocument(
      mockProvider({ withFindings: false }),
      'Hello world this is a friendly note that is at least fifty characters long.',
      {
        documentId: '33333333-3333-4333-8333-333333333333',
      },
    );
    expect(result.overallRiskScore).toBe(0);
    expect(result.debate.length).toBe(0);
  });

  it('respects skipDebate=true to use exactly 1 Gemini call', async () => {
    let calls = 0;
    const counter: AiProvider = {
      ...mockProvider(),
      async generateJson<T>(prompt: string): Promise<T> {
        calls++;
        return mockProvider().generateJson(prompt);
      },
    };
    await analyzeDocument(
      counter,
      'Company reserves unilateral right to modify terms. User waives class action rights.',
      {
        documentId: '44444444-4444-4444-8444-444444444444',
        skipDebate: true,
      },
    );
    expect(calls).toBe(1);
  });
});
