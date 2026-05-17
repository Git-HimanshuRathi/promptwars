import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Using `any` here because buildServer() returns a FastifyInstance whose
// generic Logger type is narrowed by our pino instance — that exact shape
// can't be re-imported in a test without coupling to internal logger types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.GEMINI_API_KEY = 'test-key-not-used-because-no-actual-AI-calls';
  const mod = await import('../server.js');
  app = await mod.buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('API smoke', () => {
  it('GET /healthz returns ok with provider stats', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      status: string;
      gemini: { configured: number };
      ai: { calls: number };
    };
    expect(body.status).toBe('ok');
    expect(body.gemini.configured).toBeGreaterThanOrEqual(1);
    expect(body.ai).toBeDefined();
  });

  it('CORS preflight succeeds for allowed origin', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('security headers include CSP, frame-ancestors none, nosniff', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('analyze-text rejects payloads below min length', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze-text',
      payload: { text: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/document-types returns the supported types', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/document-types' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { types: string[] };
    expect(body.types).toContain('contract');
    expect(body.types).toContain('privacy_policy');
  });
});
