import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGroqProvider, createFallbackProvider } from '../groq-provider.js';
import type { AiProvider } from '../provider.js';

const originalFetch = globalThis.fetch;

function mockFetch(responses: Array<{ ok: boolean; status?: number; body: unknown }>): void {
  let i = 0;
  globalThis.fetch = vi.fn(async () => {
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    } as Response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('createGroqProvider', () => {
  beforeEach(() => {
    mockFetch([
      {
        ok: true,
        body: { choices: [{ message: { content: 'hello from groq' } }] },
      },
    ]);
  });

  it('throws when apiKey is missing', () => {
    expect(() => createGroqProvider({ apiKey: '' })).toThrow(/apiKey/);
  });

  it('returns text content from a successful call', async () => {
    const p = createGroqProvider({ apiKey: 'gsk_test_key_long_enough' });
    const out = await p.generate('hi');
    expect(out).toBe('hello from groq');
  });

  it('exposes call count via stats()', async () => {
    const p = createGroqProvider({ apiKey: 'gsk_test_key_long_enough' });
    await p.generate('x');
    await p.generate('y');
    expect(p.stats().calls).toBe(2);
  });

  it('reports model names from modelName()', () => {
    const p = createGroqProvider({
      apiKey: 'gsk_test_key_long_enough',
      model: 'big',
      fastModel: 'small',
    });
    expect(p.modelName()).toBe('big');
    expect(p.modelName(true)).toBe('small');
  });

  it(
    'retries on 429 then surfaces error',
    async () => {
      mockFetch([
        { ok: false, status: 429, body: { error: 'Too Many Requests' } },
        { ok: false, status: 429, body: { error: 'Too Many Requests' } },
        { ok: false, status: 429, body: { error: 'Too Many Requests' } },
      ]);
      const p = createGroqProvider({ apiKey: 'gsk_test_key_long_enough' });
      await expect(p.generate('hi')).rejects.toThrow(/429|Too Many/);
    },
    15_000, // backoff totals ~9s — give the test room
  );
});

describe('createFallbackProvider', () => {
  function maker(name: string, failures = 0): AiProvider {
    let calls = 0;
    return {
      modelName: () => name,
      stats: () => ({ calls, activeKey: 0, cooledKeys: 0 }),
      async generate() {
        calls++;
        if (calls <= failures) throw new Error(`Provider ${name}: 429 Too Many Requests`);
        return `from ${name}`;
      },
      async generateJson<T>(): Promise<T> {
        calls++;
        if (calls <= failures) throw new Error(`Provider ${name}: 429 Too Many Requests`);
        return { provider: name } as T;
      },
    };
  }

  it('falls back to the next provider on 429', async () => {
    const chain = createFallbackProvider([
      maker('primary', 10), // always 429s
      maker('fallback', 0), // works
    ]);
    const out = await chain.generate('hi');
    expect(out).toBe('from fallback');
  });

  it('throws when ALL providers exhausted', async () => {
    const chain = createFallbackProvider([
      maker('a', 10),
      maker('b', 10),
    ]);
    await expect(chain.generate('hi')).rejects.toThrow();
  });

  it('returns single-provider as-is (no wrapper overhead)', () => {
    const p = maker('only');
    const chain = createFallbackProvider([p]);
    expect(chain).toBe(p);
  });

  it('propagates non-429 errors immediately without fallback', async () => {
    let secondCalled = false;
    const secondary: AiProvider = {
      modelName: () => 's',
      stats: () => ({ calls: 0, activeKey: 0, cooledKeys: 0 }),
      async generate() {
        secondCalled = true;
        return 'should not get here';
      },
      async generateJson<T>(): Promise<T> {
        secondCalled = true;
        return {} as T;
      },
    };
    const chain = createFallbackProvider([
      {
        modelName: () => 'p',
        stats: () => ({ calls: 0, activeKey: 0, cooledKeys: 0 }),
        async generate() {
          throw new Error('500 Internal Server Error');
        },
        async generateJson<T>(): Promise<T> {
          throw new Error('500 Internal Server Error');
        },
      },
      secondary,
    ]);
    await expect(chain.generate('hi')).rejects.toThrow(/500/);
    expect(secondCalled).toBe(false);
  });
});
