/**
 * Secret Manager bootstrap.
 *
 * In Cloud Run we don't ship API keys as plain env vars — we point at Secret
 * Manager resource names and resolve them at boot using the service account's
 * ADC credentials. Locally this file is a no-op: `.env.local` keys are used
 * exactly as before.
 *
 * Two activation triggers (both required):
 *   - K_SERVICE          → set by Cloud Run automatically
 *   - one of the *_SECRET env vars points at a `projects/.../secrets/.../versions/...`
 *
 * Env vars supported:
 *   GEMINI_API_KEY_SECRET   →  populates process.env.GEMINI_API_KEY
 *   GEMINI_API_KEYS_SECRET  →  populates process.env.GEMINI_API_KEYS (comma list)
 *   GROQ_API_KEY_SECRET     →  populates process.env.GROQ_API_KEY
 *
 * Each value is the full resource name. Short names like "gemini-api-key" are
 * also accepted — we expand them to `projects/$GOOGLE_CLOUD_PROJECT/secrets/<name>/versions/latest`.
 */

const SECRET_BINDINGS: Array<{ from: string; to: string }> = [
  { from: 'GEMINI_API_KEY_SECRET', to: 'GEMINI_API_KEY' },
  { from: 'GEMINI_API_KEYS_SECRET', to: 'GEMINI_API_KEYS' },
  { from: 'GROQ_API_KEY_SECRET', to: 'GROQ_API_KEY' },
];

function expandSecretRef(ref: string, project: string | undefined): string {
  if (ref.startsWith('projects/')) return ref;
  if (!project) throw new Error(`Cannot expand secret "${ref}" — GOOGLE_CLOUD_PROJECT is not set`);
  // Allow "name" or "name:version" shorthand.
  const [name, version = 'latest'] = ref.split(':');
  return `projects/${project}/secrets/${name}/versions/${version}`;
}

/**
 * Populate process.env from Secret Manager. Returns the names of resolved
 * secrets (for logging). Safe to call multiple times — idempotent.
 *
 * Designed to run **before** loadEnv() so the schema sees the resolved values.
 */
export async function loadSecretsFromGcp(): Promise<string[]> {
  if (!process.env.K_SERVICE) return []; // local dev — never touch GCP

  const bindings = SECRET_BINDINGS.filter((b) => process.env[b.from]);
  if (bindings.length === 0) return [];

  // Dynamic import — only paid for in Cloud Run.
  const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();
  const project = process.env.GOOGLE_CLOUD_PROJECT;

  const resolved: string[] = [];
  for (const { from, to } of bindings) {
    const ref = process.env[from]!;
    const fullName = expandSecretRef(ref, project);
    try {
      const [response] = await client.accessSecretVersion({ name: fullName });
      const payload = response.payload?.data?.toString();
      if (!payload) throw new Error(`Secret ${fullName} returned empty payload`);
      process.env[to] = payload.trim();
      resolved.push(to);
    } catch (err) {
      // Don't crash the whole boot on a missing secret — let the env validator
      // decide what's fatal. Surface the failure as a console.warn so it lands
      // in Cloud Logging at the WARNING severity level (the logger isn't
      // initialised yet at this point in boot).

      console.warn(
        `[lexguard:secrets] failed to load ${from} (${fullName}): ${(err as Error).message}`,
      );
    }
  }
  return resolved;
}
