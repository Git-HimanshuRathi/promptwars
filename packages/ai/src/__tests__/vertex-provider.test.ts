import { describe, it, expect, vi } from 'vitest';
import { createVertexProvider } from '../vertex-provider.js';

vi.mock('@google-cloud/vertexai', () => {
  // Per-test override hook — tests assign to `__nextResponse` to script the
  // SDK's behaviour for the upcoming call.
  const state: { nextResponse?: () => unknown; calls: number } = { calls: 0 };
  (globalThis as unknown as { __vertexState: typeof state }).__vertexState = state;

  return {
    VertexAI: class {
      getGenerativeModel() {
        return {
          generateContent: async () => {
            state.calls++;
            const fn = state.nextResponse;
            if (!fn) throw new Error('no scripted response');
            return fn() as never;
          },
        };
      }
    },
  };
});

function scriptVertex(fn: () => unknown): void {
  (globalThis as unknown as { __vertexState: { nextResponse?: () => unknown; calls: number } })
    .__vertexState.nextResponse = fn;
}

describe('createVertexProvider', () => {
  it('throws when project is missing', () => {
    expect(() => createVertexProvider({ project: '' })).toThrow(/project is required/);
  });

  it('reports configured model names', () => {
    const p = createVertexProvider({
      project: 'demo',
      model: 'gemini-pro',
      fastModel: 'gemini-flash',
    });
    expect(p.modelName()).toBe('gemini-pro');
    expect(p.modelName(true)).toBe('gemini-flash');
  });

  it('returns text from a successful Vertex call', async () => {
    scriptVertex(() => ({
      response: { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] },
    }));
    const p = createVertexProvider({ project: 'demo' });
    expect(await p.generate('hi')).toBe('{"ok":true}');
  });

  it('throws a helpful error when Vertex returns an empty response (after retries)', async () => {
    scriptVertex(() => ({ response: { candidates: [] } }));
    const p = createVertexProvider({ project: 'demo' });
    await expect(p.generate('hi')).rejects.toThrow(/empty response/);
  }, 10_000);

  it('generateJson strips fences and parses', async () => {
    scriptVertex(() => ({
      response: {
        candidates: [{ content: { parts: [{ text: '```json\n{"a":1}\n```' }] } }],
      },
    }));
    const p = createVertexProvider({ project: 'demo' });
    const out = await p.generateJson<{ a: number }>('hi');
    expect(out).toEqual({ a: 1 });
  });
});
