import { z } from 'zod';

/**
 * LEXGUARD API environment.
 * Intentionally minimal — no DB, no Redis, no Firebase.
 *
 * Gemini keys: provide any of these (multiple are rotated on 429):
 *   GEMINI_API_KEY            — single key (back-compat)
 *   GEMINI_API_KEYS           — comma-separated list of up to N keys
 *   GEMINI_API_KEY_2 / _3 ... — numbered fallbacks
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),

  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_API_KEY_2: z.string().min(10).optional(),
  GEMINI_API_KEY_3: z.string().min(10).optional(),
  GEMINI_API_KEY_4: z.string().min(10).optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GOOGLE_API_KEY: z.string().min(10).optional(),

  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_FAST_MODEL: z.string().default('gemini-2.0-flash-lite'),

  /** Optional Groq fallback (used when all Gemini keys are quota-exhausted) */
  GROQ_API_KEY: z.string().min(10).optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  // Same model for both tiers — the 8b-instant has only 6k TPM which can't
  // fit our 8k-token unified-analysis prompt under quota.
  GROQ_FAST_MODEL: z.string().default('llama-3.3-70b-versatile'),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // ── Google Cloud (production / Cloud Run) ──
  // K_SERVICE is auto-injected by Cloud Run and used as the runtime detector.
  K_SERVICE: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  VERTEX_AI_LOCATION: z.string().default('us-central1'),
  /** When 'true' AND GOOGLE_CLOUD_PROJECT is set, the AI chain prefers Vertex AI over the AI Studio key. */
  USE_VERTEX_AI: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  // Secret Manager references — resolved at boot, then injected into the matching env var.
  GEMINI_API_KEY_SECRET: z.string().optional(),
  GEMINI_API_KEYS_SECRET: z.string().optional(),
  GROQ_API_KEY_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment');
  }
  _env = parsed.data;
  return _env;
}

/**
 * Invalidate the env cache. Call after mutating process.env at boot (e.g.
 * after loading values from Secret Manager) so the next loadEnv() re-parses.
 */
export function resetEnvCache(): void {
  _env = null;
}

/**
 * Collect every Gemini key the env exposes. Dedup + filter out the placeholder
 * "your-key-here" style values.
 */
export function geminiApiKeys(env: Env): string[] {
  const fromList = (env.GEMINI_API_KEYS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const candidates = [
    env.GEMINI_API_KEY,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
    env.GEMINI_API_KEY_4,
    env.GOOGLE_API_KEY,
    ...fromList,
  ];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of candidates) {
    if (!key || key.length < 30) continue; // real Gemini keys are ~39 chars
    if (/^(your|change|example|placeholder|TODO)/i.test(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/** Back-compat for code that wants just the first key */
export function geminiApiKey(env: Env): string | undefined {
  return geminiApiKeys(env)[0];
}
