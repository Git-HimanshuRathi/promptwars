import { describe, it, expect } from 'vitest';
import { createAnalysisCache } from '../lib/cache.js';
import type { AnalysisResult } from '@lexguard/shared';

const fakeResult = (id: string): AnalysisResult =>
  ({
    documentId: id,
    documentType: 'tos',
    overallRiskScore: 50,
    riskBand: 'caution',
    summary: 's',
    executiveSummary: 'e',
    findings: [],
    debate: [],
    recommendedActions: [],
    categoryBreakdown: {},
    modelUsed: 'mock',
    durationMs: 0,
    createdAt: new Date().toISOString(),
  }) as unknown as AnalysisResult;

describe('createAnalysisCache', () => {
  it('miss → set → hit', () => {
    const c = createAnalysisCache();
    expect(c.get('k1')).toBeUndefined();
    expect(c.misses()).toBe(1);

    c.set('k1', fakeResult('d1'));
    const got = c.get('k1');
    expect(got?.documentId).toBe('d1');
    expect(c.hits()).toBe(1);
  });

  it('respects TTL — expired entries return undefined', async () => {
    const c = createAnalysisCache({ ttlMs: 50 });
    c.set('k', fakeResult('d'));
    expect(c.get('k')?.documentId).toBe('d');
    await new Promise((r) => setTimeout(r, 80));
    expect(c.get('k')).toBeUndefined();
  });

  it('evicts the oldest entry when at capacity (LRU)', () => {
    const c = createAnalysisCache({ maxEntries: 2 });
    c.set('a', fakeResult('a'));
    c.set('b', fakeResult('b'));
    c.set('c', fakeResult('c')); // evicts 'a'
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')?.documentId).toBe('b');
    expect(c.get('c')?.documentId).toBe('c');
  });

  it('touch on get bumps entry to most-recently-used', () => {
    const c = createAnalysisCache({ maxEntries: 2 });
    c.set('a', fakeResult('a'));
    c.set('b', fakeResult('b'));
    c.get('a'); // touch a — now b is oldest
    c.set('c', fakeResult('c')); // evicts b
    expect(c.get('a')?.documentId).toBe('a');
    expect(c.get('b')).toBeUndefined();
  });

  it('size() reports current entry count', () => {
    const c = createAnalysisCache();
    expect(c.size()).toBe(0);
    c.set('a', fakeResult('a'));
    c.set('b', fakeResult('b'));
    expect(c.size()).toBe(2);
  });
});
