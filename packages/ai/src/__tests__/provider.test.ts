import { describe, it, expect } from 'vitest';
import { createGeminiProvider, parseJsonSafe } from '../provider.js';

/** Make a fake GoogleGenerativeAI SDK that lets us script success/failure. */
function makeFactory(scripts: Map<string, Array<() => Promise<string>>>) {
  return (apiKey: string) => {
    const queue = scripts.get(apiKey) ?? [];
    return {
      getGenerativeModel: () => ({
        generateContent: async () => {
          const fn = queue.shift();
          if (!fn) throw new Error(`no script for ${apiKey}`);
          const text = await fn();
          return { response: { text: () => text } } as never;
        },
      }),
    } as never;
  };
}

describe('createGeminiProvider', () => {
  it('throws when no keys provided', () => {
    expect(() => createGeminiProvider({})).toThrow(/at least one/);
  });

  it('rotates to fallback key on 429', async () => {
    const scripts = new Map([
      ['key1xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', [async () => { throw new Error('429 Too Many Requests'); }]],
      ['key2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', [async () => '{"ok":true}']],
    ]);
    const p = createGeminiProvider({
      apiKeys: ['key1xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'key2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
      factory: makeFactory(scripts),
    });
    const out = await p.generate('hello');
    expect(out).toBe('{"ok":true}');
  });

  it('does not retry non-429 errors', async () => {
    const scripts = new Map([
      ['key1xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', [async () => { throw new Error('400 Bad Request'); }]],
      ['key2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', [async () => 'ok'] /* should never be hit */],
    ]);
    const p = createGeminiProvider({
      apiKeys: ['key1xxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'key2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
      factory: makeFactory(scripts),
    });
    await expect(p.generate('hi')).rejects.toThrow(/400/);
    // Second key should still have its single script entry untouched
    expect(scripts.get('key2xxxxxxxxxxxxxxxxxxxxxxxxxxxxx')!).toHaveLength(1);
  });

  it('reports model names', () => {
    const p = createGeminiProvider({
      apiKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      model: 'pro-x',
      fastModel: 'flash-x',
      factory: makeFactory(new Map()),
    });
    expect(p.modelName()).toBe('pro-x');
    expect(p.modelName(true)).toBe('flash-x');
  });

  it('stats() tracks call count', async () => {
    const scripts = new Map([
      ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', [async () => 'x', async () => 'y', async () => 'z']],
    ]);
    const p = createGeminiProvider({
      apiKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      factory: makeFactory(scripts),
    });
    await p.generate('a');
    await p.generate('b');
    expect(p.stats().calls).toBe(2);
  });
});

describe('parseJsonSafe', () => {
  it('parses plain JSON', () => {
    expect(parseJsonSafe('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(parseJsonSafe('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    expect(parseJsonSafe('```\n[1,2,3]\n```')).toEqual([1, 2, 3]);
  });

  it('extracts the largest JSON blob when surrounded by prose', () => {
    const noisy = 'Here is the result:\n{"a":1,"b":[1,2]}\nHope that helps.';
    expect(parseJsonSafe(noisy)).toEqual({ a: 1, b: [1, 2] });
  });

  it('throws when no JSON can be extracted', () => {
    expect(() => parseJsonSafe('Just plain prose. Sorry.')).toThrow(/non-JSON/);
  });
});
