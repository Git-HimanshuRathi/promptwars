/**
 * Vertex AI provider.
 *
 * Same Gemini models, but invoked through Google Cloud's managed endpoint
 * (Vertex AI) instead of the public AI Studio API. Two reasons to prefer it
 * on Cloud Run:
 *
 *   1. Auth via the service account's ADC — no API key in env or secrets.
 *   2. Much higher quota (Vertex bills per-token instead of free-tier RPD).
 *
 * The SDK is imported lazily inside `generate()` so local dev never touches
 * `@google-cloud/vertexai` (which has transitive deps that pnpm doesn't always
 * hoist cleanly). On Cloud Run the import succeeds on first call.
 */
import type { AiProvider, GenerateOptions } from './provider.js';
import { parseJsonSafe } from './provider.js';

export interface VertexProviderConfig {
  project: string;
  /** Default: us-central1 */
  location?: string;
  /** Default: gemini-2.0-flash */
  model?: string;
  /** Default: gemini-2.0-flash-lite */
  fastModel?: string;
}

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_FAST = 'gemini-2.0-flash-lite';
const DEFAULT_LOCATION = 'us-central1';

interface VertexHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGenerativeModel: (opts: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateContent: (req: any) => Promise<any>;
  };
}

export function createVertexProvider(config: VertexProviderConfig): AiProvider {
  if (!config.project) {
    throw new Error('createVertexProvider: project is required (set GOOGLE_CLOUD_PROJECT)');
  }
  const project = config.project;
  const location = config.location ?? DEFAULT_LOCATION;
  const proModelName = config.model ?? DEFAULT_MODEL;
  const fastModelName = config.fastModel ?? DEFAULT_FAST;

  let vertex: VertexHandle | undefined;
  let totalCalls = 0;

  async function getVertex(): Promise<VertexHandle> {
    if (vertex) return vertex;
    // Dynamic import — local dev (no USE_VERTEX_AI) never reaches this branch.
    const { VertexAI } = await import('@google-cloud/vertexai');
    vertex = new VertexAI({ project, location }) as unknown as VertexHandle;
    return vertex;
  }

  async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
    totalCalls++;
    const client = await getVertex();
    const name = opts.fast ? fastModelName : proModelName;
    const model = client.getGenerativeModel({
      model: name,
      systemInstruction: opts.systemInstruction
        ? { role: 'system', parts: [{ text: opts.systemInstruction }] }
        : undefined,
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

    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Vertex returned empty response');
        return text as string;
      } catch (err) {
        lastErr = err;
        const msg = (err as Error)?.message ?? '';
        const isRetryable = /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE/i.test(msg);
        if (!isRetryable) throw err;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
    throw lastErr ?? new Error('Vertex AI call failed after 3 attempts');
  }

  async function generateJson<T>(prompt: string, opts: GenerateOptions = {}): Promise<T> {
    const text = await generate(prompt, { ...opts, json: true });
    if (process.env.LEXGUARD_DEBUG_AI) {

      console.error('[lexguard:vertex] raw response:', text.slice(0, 500));
    }
    return parseJsonSafe<T>(text);
  }

  return {
    generate,
    generateJson,
    modelName: (fast = false) => (fast ? fastModelName : proModelName),
    stats: () => ({ calls: totalCalls, activeKey: 0, cooledKeys: 0 }),
  };
}
