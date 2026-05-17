/**
 * Additional coverage for adapt-analysis.ts focused on the section-label
 * extractor (the one that replaces the synthetic "§ 1.1" labels with real
 * "Clause N" or "Section X" labels parsed from the clause text).
 */
import { describe, it, expect } from 'vitest';
import { adaptFindings } from '@/lib/adapt-analysis';
import type { ClauseFinding } from '@lexguard/shared';

const finding = (over: Partial<ClauseFinding> = {}): ClauseFinding => ({
  id: 'x',
  text: 'Default clause text long enough',
  span: [0, 32],
  category: 'one_sided',
  severity: 'high',
  riskScore: 70,
  confidence: 0.9,
  plainEnglish: 'A bad clause.',
  recommendation: 'Negotiate.',
  agent: 'risk_detection',
  ...over,
});

describe('adaptFindings — section-label extractor', () => {
  it('extracts "Section 4" prefix', () => {
    const out = adaptFindings([finding({ text: 'Section 4. Termination. Either party may terminate.' })]);
    expect(out[0]!.section).toBe('Section 4');
  });

  it('extracts "Article XI" prefix', () => {
    const out = adaptFindings([finding({ text: 'Article XI — Limitation of Liability.' })]);
    expect(out[0]!.section).toBe('Article XI');
  });

  it('extracts "Clause 3.2" prefix', () => {
    const out = adaptFindings([finding({ text: 'Clause 3.2 — Auto renewal applies.' })]);
    expect(out[0]!.section).toBe('Clause 3.2');
  });

  it('extracts § silcrow prefix as "Clause N.M"', () => {
    const out = adaptFindings([finding({ text: '§ 11.4 Vendor liability cap.' })]);
    expect(out[0]!.section).toBe('Clause 11.4');
  });

  it('extracts leading numbered prefix "4."', () => {
    const out = adaptFindings([finding({ text: '4. You assume all risk of injury.' })]);
    expect(out[0]!.section).toBe('Clause 4');
  });

  it('extracts leading numbered prefix with paren "1)"', () => {
    const out = adaptFindings([finding({ text: '1) No refunds allowed.' })]);
    expect(out[0]!.section).toBe('Clause 1');
  });

  it('extracts leading lettered prefix "(a)"', () => {
    const out = adaptFindings([finding({ text: '(a) Both parties agree.' })]);
    expect(out[0]!.section).toBe('Item A');
  });

  it('falls back to "Clause N" when no pattern matches', () => {
    const out = adaptFindings([
      finding({ text: 'No prefix at all here, just words.' }),
      finding({ text: 'Another prefixless clause.' }),
    ]);
    expect(out[0]!.section).toBe('Clause 1');
    expect(out[1]!.section).toBe('Clause 2');
  });

  it('handles missing text gracefully', () => {
    const out = adaptFindings([finding({ text: '' })]);
    expect(out[0]!.section).toBe('Clause 1');
  });
});
