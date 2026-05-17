/**
 * Unified adversarial-debate agent — replaces user_advocate + counterargument
 * with one Gemini call that returns both sides' turns at once.
 *
 * Output preserves the original semantics: each turn has a role
 * (predator/counsel), an argument, agrees boolean, and confidence — and we
 * still apply confidence-weighted risk-score adjustments from the counsel side.
 */
import type { AgentContext } from './base.js';
import type { AgentDebateTurn, ClauseFinding } from '@lexguard/shared/types';
import { fenceUntrusted } from '../firewall.js';

const SYSTEM = `You moderate LEXGUARD's adversarial debate. For each finding,
produce TWO short arguments — one from each side.

  PREDATOR (user_advocate): the user's friend. Argue why this clause is bad
    for the user in plain, everyday words. Give a concrete real-world example
    of what could go wrong.

  COUNSEL (counterargument): the company's friend. Argue why this clause
    might be reasonable, normal in the industry, or legally needed. If the
    counterargument is genuinely strong, set agrees=false with high
    confidence so the risk score drops.

═══════════════════════════════════════════════════════════════════════════
WRITING RULES — IMPORTANT
═══════════════════════════════════════════════════════════════════════════

Imagine you are explaining this to a 10-year-old kid AND a 70-year-old
grandparent. Both must understand.

  • Use SHORT sentences. Max 14 words each.
  • Use everyday words. NO legal jargon.
  • Use "you" not "the user" or "users".
  • Give a real-world example when possible.
      Predator example: "If you slip and break your ankle, the venue pays
        nothing. You could end up with a $30,000 hospital bill."
      Counsel example: "Most venues use this to stop people suing them for
        their own clumsiness. It is a standard rule in the events industry."
  • 1-3 short sentences per argument. Total under 50 words.

Return one JSON object: { turns: [{role, findingId, argument, agrees,
confidence}] }.

  role: "predator" | "counsel"
  agrees: true = concur with the original severity; false = push back
  confidence: 0.0–1.0`;

const SCHEMA = {
  type: 'object',
  properties: {
    turns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          findingId: { type: 'string' },
          argument: { type: 'string' },
          agrees: { type: 'boolean' },
          confidence: { type: 'number' },
        },
        required: ['role', 'findingId', 'argument', 'agrees', 'confidence'],
      },
    },
  },
  required: ['turns'],
} as const;

interface RawTurn {
  role: 'predator' | 'counsel' | string;
  findingId: string;
  argument: string;
  agrees: boolean;
  confidence: number;
}

export async function runUnifiedDebate(
  findings: ClauseFinding[],
  ctx: AgentContext,
): Promise<{ debate: AgentDebateTurn[]; adjustments: Map<string, number> }> {
  if (findings.length === 0) {
    return { debate: [], adjustments: new Map() };
  }

  // Cap to top 15 findings — debate quality degrades past that and we want
  // to keep tokens-per-call low for free-tier quota.
  const summarized = findings.slice(0, 15).map((f) => ({
    id: f.id,
    category: f.category,
    severity: f.severity,
    riskScore: f.riskScore,
    text: f.text.slice(0, 300),
    plainEnglish: f.plainEnglish.slice(0, 220),
  }));

  const prompt = [
    SYSTEM,
    '',
    'Findings to debate (one predator + one counsel turn per finding):',
    fenceUntrusted(JSON.stringify(summarized, null, 2)),
    '',
    'Return ONLY: { turns: [{role, findingId, argument, agrees, confidence}, ...] }',
  ].join('\n');

  const raw = await ctx.ai.generateJson<{ turns: RawTurn[] }>(prompt, {
    json: true,
    schema: SCHEMA as never,
    temperature: 0.35,
    // Each debate turn is ~30 words; 2048 covers up to ~20 turns comfortably
    // and shaves real latency vs the 4096 default.
    maxOutputTokens: 2048,
    systemInstruction: SYSTEM,
    fast: true,
  });

  const debate: AgentDebateTurn[] = [];
  const adjustments = new Map<string, number>();

  for (const t of raw.turns ?? []) {
    const role = String(t.role ?? '').toLowerCase();
    const isCounsel = role === 'counsel' || role === 'counterargument';
    debate.push({
      agent: isCounsel ? 'counterargument' : 'user_advocate',
      argument: String(t.argument ?? '').slice(0, 4000),
      agrees: Boolean(t.agrees),
      confidence: clamp01(t.confidence ?? 0.6),
    });

    // Strong counsel counterargument that disagrees lowers the risk score
    if (isCounsel && !t.agrees && t.confidence > 0.7) {
      adjustments.set(t.findingId, -Math.round(15 * t.confidence));
    }
  }

  return { debate, adjustments };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
