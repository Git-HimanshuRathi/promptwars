/**
 * Groq fallback provider.
 *
 * Groq runs Llama / Mixtral models via an OpenAI-compatible API with
 * generous free-tier quotas (14,400 RPD vs Gemini's 1,500 on free tier).
 * We use it as a safety-net when Gemini's quota is exhausted — the same
 * orchestrator code drives both providers because they share the AiProvider
 * interface.
 */
import type { AiProvider, GenerateOptions } from './provider.js';
import { parseJsonSafe } from './provider.js';

export interface GroqProviderConfig {
  apiKey: string;
  /** Default: llama-3.3-70b-versatile (best for legal reasoning) */
  model?: string;
  /** Default: llama-3.1-8b-instant (used when opts.fast is true) */
  fastModel?: string;
  /** Override endpoint for tests */
  baseUrl?: string;
}

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
// Same model for both tiers — llama-3.1-8b-instant has only 6k TPM which can't
// fit our 8k-token unified-analysis prompt. The 70b versatile has 30k TPM and
// is still sub-second on Groq's LPU hardware, so we lose nothing by using it.
const DEFAULT_FAST = 'llama-3.3-70b-versatile';
const DEFAULT_BASE = 'https://api.groq.com/openai/v1';

export function createGroqProvider(config: GroqProviderConfig): AiProvider {
  if (!config.apiKey || config.apiKey.length < 10) {
    throw new Error('createGroqProvider: apiKey is required');
  }
  const proModel = config.model ?? DEFAULT_MODEL;
  const fastModel = config.fastModel ?? DEFAULT_FAST;
  const baseUrl = config.baseUrl ?? DEFAULT_BASE;
  let totalCalls = 0;

  async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    totalCalls++;
    const model = opts.fast ? fastModel : proModel;

    const messages: Array<{ role: string; content: string }> = [];
    if (opts.systemInstruction) {
      messages.push({ role: 'system', content: opts.systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxOutputTokens ?? 4096,
    };
    if (opts.json) {
      body.response_format = { type: 'json_object' };
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          if (res.status === 429 || res.status === 503) {
            // Surface as a 429-like error so the fallback wrapper can rotate
            throw new Error(`Groq ${res.status} Too Many Requests: ${text.slice(0, 200)}`);
          }
          throw new Error(`Groq HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Groq returned empty response');
        }
        return content;
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? '';
        if (!/429|503|Too Many|fetch failed/i.test(msg)) throw err;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw lastErr ?? new Error('Groq call failed after 3 attempts');
  }

  async function generateJson<T>(prompt: string, opts: GenerateOptions = {}): Promise<T> {
    const text = await generate(prompt, { ...opts, json: true });
    if (process.env.LEXGUARD_DEBUG_AI) {
       
      console.error('[lexguard:groq] raw response:', text.slice(0, 500));
    }
    return parseJsonSafe<T>(text);
  }

  return {
    generate,
    generateJson,
    modelName: (fast = false) => (fast ? fastModel : proModel),
    stats: () => ({ calls: totalCalls, activeKey: 0, cooledKeys: 0 }),
  };
}

/**
 * Fallback wrapper — tries providers in order. On a 429-class failure from
 * the active provider, rotates to the next. The next call resumes from the
 * primary (so transient quota windows recover automatically).
 */
export function createFallbackProvider(providers: AiProvider[]): AiProvider {
  if (providers.length === 0) {
    throw new Error('createFallbackProvider: at least one provider required');
  }
  if (providers.length === 1) return providers[0]!;

  let totalCalls = 0;
  // Per-provider cooldowns
  const cooledUntil = new Map<number, number>();

  async function tryAll<T>(
    fn: (p: AiProvider) => Promise<T>,
    label: string,
  ): Promise<T> {
    totalCalls++;
    let lastErr: unknown;
    const now = Date.now();
    for (let i = 0; i < providers.length; i++) {
      const cool = cooledUntil.get(i);
      if (cool && cool > now) continue; // skip cooled providers
      try {
        const result = await fn(providers[i]!);
        return result;
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? '';
        const is429 = /429|Too Many|quota|exhausted/i.test(msg);
        if (!is429) throw err; // non-retryable
        // Cool this provider for 5 min and rotate
        cooledUntil.set(i, Date.now() + 5 * 60 * 1000);
        if (process.env.LEXGUARD_DEBUG_AI) {
           
          console.error(
            `[lexguard:fallback] provider #${i} hit 429 on ${label}, falling back`,
          );
        }
      }
    }
    throw lastErr ?? new Error('All AI providers exhausted');
  }

  return {
    generate: (prompt, opts) => tryAll((p) => p.generate(prompt, opts), 'generate'),
    generateJson: <T,>(prompt: string, opts?: GenerateOptions) =>
      tryAll<T>((p) => p.generateJson<T>(prompt, opts), 'generateJson'),
    modelName: (fast) => providers[0]!.modelName(fast),
    stats: () => {
      const cooled = [...cooledUntil.values()].filter((t) => t > Date.now()).length;
      return { calls: totalCalls, activeKey: 0, cooledKeys: cooled };
    },
  };
}
