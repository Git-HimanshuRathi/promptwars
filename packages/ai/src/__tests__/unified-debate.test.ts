import { describe, it, expect } from 'vitest';
import { runUnifiedDebate } from '../agents/unified-debate.js';
import type { AiProvider } from '../provider.js';
import type { ClauseFinding } from '@lexguard/shared/types';

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

const finding = (over: Partial<ClauseFinding> = {}): ClauseFinding => ({
  id: 'f1',
  text: 'Vendor liability capped at 12 months fees.',
  span: [0, 42],
  category: 'one_sided',
  severity: 'critical',
  riskScore: 88,
  confidence: 0.9,
  plainEnglish: 'They cap their blame.',
  recommendation: 'Mirror the cap.',
  agent: 'risk_detection',
  ...over,
});

describe('runUnifiedDebate', () => {
  it('returns empty result when no findings', async () => {
    const out = await runUnifiedDebate([], {
      ai: mockProvider({ turns: [] }),
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });
    expect(out.debate).toEqual([]);
    expect(out.adjustments.size).toBe(0);
  });

  it('maps predator/counsel roles correctly', async () => {
    const out = await runUnifiedDebate([finding()], {
      ai: mockProvider({
        turns: [
          { role: 'predator', findingId: 'f1', argument: 'Bad clause.', agrees: true, confidence: 0.9 },
          { role: 'counsel', findingId: 'f1', argument: 'Standard.', agrees: false, confidence: 0.5 },
        ],
      }),
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });

    expect(out.debate).toHaveLength(2);
    expect(out.debate[0]!.agent).toBe('user_advocate');
    expect(out.debate[1]!.agent).toBe('counterargument');
  });

  it('applies score adjustment when counsel disagrees with high confidence', async () => {
    const out = await runUnifiedDebate([finding({ id: 'f1' })], {
      ai: mockProvider({
        turns: [
          { role: 'counsel', findingId: 'f1', argument: 'Industry standard.', agrees: false, confidence: 0.85 },
        ],
      }),
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });

    expect(out.adjustments.has('f1')).toBe(true);
    expect(out.adjustments.get('f1')!).toBeLessThan(0); // downward adjustment
  });

  it('does NOT adjust when counsel confidence is below 0.7', async () => {
    const out = await runUnifiedDebate([finding({ id: 'f1' })], {
      ai: mockProvider({
        turns: [
          { role: 'counsel', findingId: 'f1', argument: 'Maybe ok.', agrees: false, confidence: 0.5 },
        ],
      }),
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });

    expect(out.adjustments.has('f1')).toBe(false);
  });

  it('clamps confidence into [0, 1]', async () => {
    const out = await runUnifiedDebate([finding()], {
      ai: mockProvider({
        turns: [
          { role: 'predator', findingId: 'f1', argument: 'x', agrees: true, confidence: 5 }, // out of range
          { role: 'counsel', findingId: 'f1', argument: 'y', agrees: true, confidence: -1 },
        ],
      }),
      documentId: 'd-1',
      documentType: 'tos',
      language: 'en',
    });

    expect(out.debate[0]!.confidence).toBe(1);
    expect(out.debate[1]!.confidence).toBe(0);
  });
});
