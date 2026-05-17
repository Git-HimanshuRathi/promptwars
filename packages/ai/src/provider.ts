import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

export interface AiProviderConfig {
  /**
   * One or more API keys. When multiple are provided, the provider uses a
   * circuit-breaker pattern: on 429 the active key is cooled for the duration
   * Google hints (or 60s by default) and the next key is rotated in.
   */
  apiKey?: string;
  apiKeys?: string[];
  model?: string;
  fastModel?: string;
  /** Override the SDK constructor — useful for tests */
  factory?: (apiKey: string) => GoogleGenerativeAI;
}

export interface GenerateOptions {
  /** Use the fast/cheap model variant */
  fast?: boolean;
  /** Force JSON output via responseMimeType */
  json?: boolean;
  /** JSON schema for structured output (Gemini schema dialect) */
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export interface AiProvider {
  generate(prompt: string, opts?: GenerateOptions): Promise<string>;
  generateJson<T = unknown>(prompt: string, opts?: GenerateOptions): Promise<T>;
  modelName(fast?: boolean): string;
  /** Telemetry — call counts and current active key index */
  stats(): { calls: number; activeKey: number; cooledKeys: number };
}

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_FAST = 'gemini-2.0-flash-lite';
const DEFAULT_COOLDOWN_MS = 60_000;

export function createGeminiProvider(config: AiProviderConfig): AiProvider {
  const keys = (config.apiKeys?.length ? config.apiKeys : [config.apiKey])
    .filter((k): k is string => typeof k === 'string' && k.length >= 10);

  if (keys.length === 0) {
    throw new Error('createGeminiProvider: at least one API key is required');
  }

  const clients = keys.map((k) =>
    config.factory ? config.factory(k) : new GoogleGenerativeAI(k),
  );

  const proModel = config.model ?? DEFAULT_MODEL;
  const fastModel = config.fastModel ?? DEFAULT_FAST;

  // Circuit breaker state
  let activeIndex = 0;
  let totalCalls = 0;
  const cooledUntil = new Map<number, number>(); // keyIndex → epoch ms

  function getClient(): { client: GoogleGenerativeAI; index: number } {
    const now = Date.now();
    // Try up to N rotations to find an un-cooled key
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const cool = cooledUntil.get(activeIndex);
      if (!cool || cool <= now) {
        return { client: clients[activeIndex]!, index: activeIndex };
      }
      activeIndex = (activeIndex + 1) % keys.length;
    }
    // All keys cool — pick the one with the soonest expiry
    let soonest = 0;
    let soonestAt = Infinity;
    for (let i = 0; i < keys.length; i++) {
      const at = cooledUntil.get(i) ?? 0;
      if (at < soonestAt) {
        soonestAt = at;
        soonest = i;
      }
    }
    activeIndex = soonest;
    return { client: clients[soonest]!, index: soonest };
  }

  function buildModel(client: GoogleGenerativeAI, opts: GenerateOptions): GenerativeModel {
    const name = opts.fast ? fastModel : proModel;
    return client.getGenerativeModel({
      model: name,
      systemInstruction: opts.systemInstruction,
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 4096,
        ...(opts.json
          ? {
              responseMimeType: 'application/json',
              ...(opts.schema ? { responseSchema: opts.schema as never } : {}),
            }
          : {}),
      },
    });
  }

  async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    totalCalls++;
    let lastErr: unknown;
    // Up to (keys.length × 3) total attempts — each key gets up to 3 retries
    const maxAttempts = Math.max(3, keys.length * 3);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { client, index } = getClient();
      const model = buildModel(client, opts);

      try {
        const result = await model.generateContent(prompt);
        // Success — clear this key's cooldown if it was previously cooled
        if (cooledUntil.has(index)) cooledUntil.delete(index);
        return result.response.text();
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? '';
        const is429 = msg.includes('429') || /Too Many Requests/i.test(msg);
        const is503 = msg.includes('503') || /unavailable/i.test(msg);

        if (!is429 && !is503) {
          throw err; // non-retryable
        }

        // Extract Google's retryDelay hint if present
        const retryHint = msg.match(/retryDelay"\s*:\s*"(\d+)s"/);
        const isDaily = /PerDay/i.test(msg);
        let cooldownMs: number;
        if (isDaily) {
          // Daily quota — cool this key for the rest of the calendar day (Pacific).
          // Use 4h as a safe minimum so we don't hammer it.
          cooldownMs = 4 * 60 * 60 * 1000;
        } else if (retryHint?.[1]) {
          cooldownMs = Math.min(parseInt(retryHint[1], 10) * 1000 + 500, 90_000);
        } else {
          cooldownMs = DEFAULT_COOLDOWN_MS;
        }

        cooledUntil.set(index, Date.now() + cooldownMs);

        if (process.env.LEXGUARD_DEBUG_AI) {
          console.error(
            `[lexguard:ai] key #${index} cooled for ${Math.round(cooldownMs / 1000)}s ` +
              `(${isDaily ? 'daily' : 'rpm'} quota). Rotating.`,
          );
        }

        if (keys.length > 1) {
          // Rotate to next key for the next attempt
          activeIndex = (activeIndex + 1) % keys.length;
        } else {
          // Only one key — wait it out
          await new Promise((r) => setTimeout(r, Math.min(cooldownMs, 15_000)));
        }
      }
    }
    throw lastErr ?? new Error('Gemini call failed: all keys exhausted');
  }

  async function generateJson<T>(prompt: string, opts: GenerateOptions = {}): Promise<T> {
    const text = await generate(prompt, { ...opts, json: true });
    if (process.env.LEXGUARD_DEBUG_AI) {
       
      console.error('[lexguard:ai] raw response:', text.slice(0, 500));
    }
    return parseJsonSafe<T>(text);
  }

  return {
    generate,
    generateJson,
    modelName: (fast = false) => (fast ? fastModel : proModel),
    stats: () => ({
      calls: totalCalls,
      activeKey: activeIndex,
      cooledKeys: [...cooledUntil.values()].filter((t) => t > Date.now()).length,
    }),
  };
}

/**
 * Tolerant JSON parser — Gemini sometimes wraps output in ```json fences
 * even when responseMimeType is set, especially in older SDK versions.
 */
export function parseJsonSafe<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`AI returned non-JSON response: ${cleaned.slice(0, 200)}`);
  }
}
