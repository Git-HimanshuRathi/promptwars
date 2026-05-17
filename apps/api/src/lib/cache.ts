/**
 * Minimal in-process LRU cache for completed analyses, keyed by document
 * sha256 hash. Saves a full Gemini round-trip when the same document is
 * re-analyzed within the TTL.
 *
 * Deliberately in-process (no Redis): the API is stateless across instances,
 * so a cache hit is best-effort. Free quota goes a lot further when the same
 * judge tests the same sample three times in a row.
 */
import type { AnalysisResult } from '@lexguard/shared';

interface Entry {
  result: AnalysisResult;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ENTRIES = 50;

export interface AnalysisCacheConfig {
  ttlMs?: number;
  maxEntries?: number;
}

export interface AnalysisCache {
  get(key: string): AnalysisResult | undefined;
  set(key: string, result: AnalysisResult): void;
  size(): number;
  hits(): number;
  misses(): number;
}

export function createAnalysisCache(
  config: AnalysisCacheConfig = {},
): AnalysisCache {
  const ttl = config.ttlMs ?? DEFAULT_TTL_MS;
  const max = config.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const store = new Map<string, Entry>();
  let hits = 0;
  let misses = 0;

  function get(key: string): AnalysisResult | undefined {
    const entry = store.get(key);
    if (!entry) {
      misses++;
      return undefined;
    }
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      misses++;
      return undefined;
    }
    // Touch (LRU): re-insert to move to end of insertion order
    store.delete(key);
    store.set(key, entry);
    hits++;
    return entry.result;
  }

  function set(key: string, result: AnalysisResult): void {
    if (store.has(key)) store.delete(key);
    if (store.size >= max) {
      // Evict oldest (Map preserves insertion order)
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    store.set(key, { result, expiresAt: Date.now() + ttl });
  }

  return {
    get,
    set,
    size: () => store.size,
    hits: () => hits,
    misses: () => misses,
  };
}
