/**
 * Unified analysis agent — replaces the four specialized clause-finding agents
 * + simplification agent with a single Gemini call.
 *
 * Why: Free-tier Gemini quota is per-request, not per-token. Running 5
 * separate calls per analysis chews through 1,500 RPD in ~300 analyses.
 * The unified call covers all categories in one prompt with a checklist
 * structure that keeps recall high while using 1 quota unit instead of 5.
 */
import type { AgentContext } from './base.js';
import {
  FINDINGS_SCHEMA,
  buildAnalysisPrompt,
  normalizeFinding,
  type RawFinding,
} from './base.js';
import type { ClauseFinding } from '@lexguard/shared/types';

const SYSTEM = `You are LEXGUARD — a friendly legal-risk reviewer who explains
contracts so that a 10-year-old kid and a 70-year-old grandparent can both
understand. You scan documents for four kinds of trouble in one pass:

  1. UNFAIR or one-sided rules — when one side has way more power.
     (indemnity overreach, unilateral changes, arbitration traps,
     class-action waivers, IP grabs, non-competes, dark patterns)

  2. CONFUSING or VAGUE words — when terms like "at our sole discretion"
     or "from time to time" let the company decide later what they meant.

  3. PRIVACY problems — when the company can use your data, photos, or
     content forever, sell it, train AI with it, or refuse to delete it.

  4. MONEY traps — auto-renewal, sneaky price hikes, big penalty fees,
     refund denials, personal guarantees, deposit forfeiture.

═══════════════════════════════════════════════════════════════════════════
HOW TO WRITE (THIS IS THE MOST IMPORTANT PART)
═══════════════════════════════════════════════════════════════════════════

Imagine you are explaining the contract to your grandma over coffee.

For \`plainEnglish\` (the explanation):
  • Use SHORT sentences. Maximum 12 words per sentence.
  • Use COMMON, everyday words. NEVER use legal jargon.
  • REPLACE these words:
      "indemnify"          → "pay for"
      "arbitration"        → "private hearing instead of court"
      "perpetuity"         → "forever"
      "liability"          → "blame" or "responsibility"
      "assumption of risk" → "you take the blame"
      "waiver"             → "give up your right to"
      "binding"            → "you can't change your mind later"
      "in perpetuity"      → "forever, with no end"
      "third party"        → "someone else / outsiders"
      "consideration"      → "what you get in return"
      "discretion"         → "they get to decide"
      "remedy"             → "fix" or "what you get"
      "jurisdiction"       → "which court / which state"
      "termination"        → "ending the deal"
  • Use SECOND PERSON ("you") — talk directly to the reader.
  • Use a CONCRETE EXAMPLE when it helps. E.g.:
      "If you fall and break your arm, the venue won't pay your hospital bill."
      "If you cancel late, you still owe money for another full year."
  • 2 short sentences MAX. The first says what it means; the second says
    why it matters or gives an example.

For \`recommendation\` (what to do):
  • One short sentence. Imperative. Max 12 words.
  • Examples:
      "Ask for the right to a refund if the event is cancelled."
      "Push back: the company should also be limited, not just you."
      "Don't sign unless they remove the lifetime data license."

═══════════════════════════════════════════════════════════════════════════
OUTPUT
═══════════════════════════════════════════════════════════════════════════

For EACH issue you find, return:
  text             — EXACT clause text copied from the document (verbatim)
  category         — exploitative | hidden_liability | legal_ambiguity |
                     one_sided | financial_risk | data_privacy | auto_renewal |
                     cancellation_trap | arbitration_trap | indemnity |
                     ip_assignment | non_compete | jurisdiction |
                     limitation_of_liability | dark_pattern
  severity         — critical | high | medium | low
  riskScore        — 0–100 (worst-case real-world harm)
  plainEnglish     — grade-3 reading level explanation (see rules above)
  recommendation   — one short imperative sentence
  saferAlternative — optional: redrafted clause that fixes the problem

Be precise about WHICH clause; quote EXACT text. Never invent text.
If a clause is genuinely fair to both sides, skip it.`;

const SCHEMA = {
  type: 'object',
  properties: {
    findings: FINDINGS_SCHEMA.properties.findings,
    executiveSummary: { type: 'string' },
    summary: { type: 'string' },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['findings', 'executiveSummary', 'summary', 'recommendedActions'],
} as const;

export interface UnifiedAnalysisResult {
  findings: ClauseFinding[];
  executiveSummary: string;
  summary: string;
  recommendedActions: string[];
}

interface RawUnified {
  findings: RawFinding[];
  executiveSummary: string;
  summary: string;
  recommendedActions: string[];
}

export async function runUnifiedAnalysis(
  text: string,
  ctx: AgentContext,
): Promise<UnifiedAnalysisResult> {
  const prompt = buildAnalysisPrompt({
    rolePrompt: SYSTEM,
    text,
    documentType: ctx.documentType,
    jurisdiction: ctx.jurisdiction,
    language: ctx.language,
  });

  // Add the summary-shape instruction since the unified prompt extends
  // findings-only output. Same plain-language rules apply here.
  const fullPrompt =
    prompt +
    '\n\nAlso return (use the SAME grade-3 plain-language rules):\n' +
    '  executiveSummary  — 1-2 short sentences. The top-line verdict in everyday\n' +
    '                       words. Example: "This contract is heavily one-sided.\n' +
    '                       It puts most of the risk and money problems on you."\n' +
    '  summary           — 3-5 short sentences. The story of what is going on,\n' +
    '                       in plain English. No legal terms.\n' +
    '  recommendedActions — 3-6 short bullets. Each is an imperative sentence,\n' +
    '                       max 12 words. Examples:\n' +
    '                       ["Ask the company to mirror their own liability cap.",\n' +
    '                        "Get email confirmation that you can cancel anytime.",\n' +
    '                        "Refuse the lifetime data license without compensation."]\n' +
    '\nReturn ONLY a JSON object with keys: findings, executiveSummary, summary, recommendedActions.';

  const raw = await ctx.ai.generateJson<RawUnified>(fullPrompt, {
    json: true,
    schema: SCHEMA as never,
    temperature: 0.2,
    // 4096 is plenty for ~10 findings + summary; halving the budget noticeably
    // reduces Gemini latency because the model pre-allocates the upper bound.
    maxOutputTokens: 4096,
    systemInstruction: SYSTEM,
    // Flash-lite produces equally clean JSON under the responseSchema constraint
    // and is 2-3× faster than the pro flash model. The structured-output
    // contract does the heavy lifting, not the model's reasoning depth.
    fast: true,
  });

  const findings: ClauseFinding[] = [];
  for (const [i, rawFinding] of (raw.findings ?? []).entries()) {
    const f = normalizeFinding(rawFinding, 'risk_detection', i, text.length);
    if (f) {
      // Route the finding to the most plausible agent for UI presentation.
      const cat = f.category;
      f.agent =
        cat === 'data_privacy'
          ? 'privacy'
          : cat === 'financial_risk' ||
              cat === 'auto_renewal' ||
              cat === 'hidden_liability'
            ? 'financial'
            : cat === 'legal_ambiguity'
              ? 'ambiguity'
              : 'risk_detection';
      findings.push(f);
    }
  }

  return {
    findings,
    executiveSummary: (raw.executiveSummary ?? '').slice(0, 4000),
    summary: (raw.summary ?? '').slice(0, 4000),
    recommendedActions: (raw.recommendedActions ?? [])
      .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
      .slice(0, 20)
      .map((a) => a.slice(0, 500)),
  };
}

