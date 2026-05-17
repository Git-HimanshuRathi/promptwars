import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { loadEnv, resetEnvCache, geminiApiKey, geminiApiKeys } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { extractText } from './services/extract.js';
import { createAnalysisCache } from './lib/cache.js';
import {
  analyzeDocument,
  createGeminiProvider,
  createGroqProvider,
  createVertexProvider,
  createFallbackProvider,
  type AiProvider,
} from '@lexguard/ai';
import { loadSecretsFromGcp } from './lib/secrets.js';
import {
  analysisResultSchema,
  documentTypeSchema,
  uploadMetadataSchema,
  MAX_UPLOAD_BYTES,
  DOCUMENT_TYPES,
  type AnalysisProgressEvent,
  type AnalysisResult,
} from '@lexguard/shared';

/* -------------------------------------------------------------------------- */
/*  AI provider (lazy)                                                        */
/* -------------------------------------------------------------------------- */

let _ai: AiProvider | null = null;
function getAi(): AiProvider {
  if (_ai) return _ai;
  const env = loadEnv();
  const keys = geminiApiKeys(env);
  const hasGemini = keys.length > 0;
  const hasGroq = Boolean(env.GROQ_API_KEY);
  // Vertex AI needs a project + the explicit opt-in flag. Both come from the
  // Cloud Run env. Locally `USE_VERTEX_AI` is unset, so this stays false.
  const hasVertex = env.USE_VERTEX_AI === true && Boolean(env.GOOGLE_CLOUD_PROJECT);

  if (!hasGemini && !hasGroq && !hasVertex) {
    throw new Error(
      'No AI provider configured. Set GEMINI_API_KEY (https://aistudio.google.com/apikey), ' +
        'GROQ_API_KEY (https://console.groq.com/keys), or enable Vertex AI with ' +
        'USE_VERTEX_AI=true + GOOGLE_CLOUD_PROJECT.',
    );
  }

  // Provider preference on Cloud Run: Vertex → Gemini AI Studio → Groq.
  // Vertex uses ADC (no key) and has the highest quota, so it goes first.
  const chain: AiProvider[] = [];
  if (hasVertex) {
    chain.push(
      createVertexProvider({
        project: env.GOOGLE_CLOUD_PROJECT!,
        location: env.VERTEX_AI_LOCATION,
        model: env.GEMINI_MODEL,
        fastModel: env.GEMINI_FAST_MODEL,
      }),
    );
  }
  if (hasGemini) {
    chain.push(
      createGeminiProvider({
        apiKeys: keys,
        model: env.GEMINI_MODEL,
        fastModel: env.GEMINI_FAST_MODEL,
      }),
    );
  }
  if (hasGroq) {
    chain.push(
      createGroqProvider({
        apiKey: env.GROQ_API_KEY!,
        model: env.GROQ_MODEL,
        fastModel: env.GROQ_FAST_MODEL,
      }),
    );
  }

  logger.info(
    {
      vertex: { configured: hasVertex, project: env.GOOGLE_CLOUD_PROJECT, location: env.VERTEX_AI_LOCATION },
      gemini: { configured: hasGemini, keyCount: keys.length, model: env.GEMINI_MODEL },
      groq: { configured: hasGroq, model: env.GROQ_MODEL },
      chain: chain.length,
    },
    `AI provider chain ready (${chain.length} provider${chain.length > 1 ? 's' : ''})`,
  );

  _ai = createFallbackProvider(chain);
  return _ai;
}

/* -------------------------------------------------------------------------- */
/*  Server factory                                                            */
/* -------------------------------------------------------------------------- */

export async function buildServer() {
  const env = loadEnv();
  const cache = createAnalysisCache();

  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    bodyLimit: MAX_UPLOAD_BYTES + 1024,
    genReqId: () => uuid(),
    disableRequestLogging: env.NODE_ENV === 'production',
  });

  app.setErrorHandler(errorHandler);

  // ── Security ───────────────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.googleapis.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    // CORP defaults to 'same-origin' which blocks the web app at :3000 from
    // reading our responses at :4000 even with CORS allowed. We explicitly
    // mark the API as cross-origin so the browser permits the read.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: env.NODE_ENV === 'production'
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 86400,
  });

  // gzip + brotli compression for all JSON responses ≥1KB.
  // Skips Server-Sent Events automatically (text/event-stream is excluded).
  await app.register(compress, {
    global: true,
    encodings: ['br', 'gzip'],
    threshold: 1024,
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: (req) => req.url === '/healthz',
    errorResponseBuilder: (_req, ctx) => ({
      error: 'Too Many Requests',
      retryAfterSeconds: Math.ceil(ctx.ttl / 1000),
    }),
  });

  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8, headerPairs: 100 },
  });

  await app.register(sensible);

  // ── Health ─────────────────────────────────────────────────────────
  app.get('/healthz', async () => {
    const stats = _ai?.stats?.() ?? { calls: 0, activeKey: 0, cooledKeys: 0 };
    return {
      status: 'ok',
      vertex: {
        configured: env.USE_VERTEX_AI === true && Boolean(env.GOOGLE_CLOUD_PROJECT),
        project: env.GOOGLE_CLOUD_PROJECT ?? null,
        location: env.VERTEX_AI_LOCATION,
      },
      gemini: { configured: geminiApiKeys(env).length, model: env.GEMINI_MODEL },
      groq: { configured: Boolean(env.GROQ_API_KEY), model: env.GROQ_MODEL },
      cloudRun: Boolean(process.env.K_SERVICE),
      ai: stats,
      cache: {
        size: cache.size(),
        hits: cache.hits(),
        misses: cache.misses(),
      },
      ts: new Date().toISOString(),
    };
  });

  // ── POST /api/analyze-text — paste text and analyze ────────────────
  app.post('/api/analyze-text', async (req, reply) => {
    const body = z
      .object({
        text: z.string().min(50).max(250_000),
        documentType: documentTypeSchema.default('other'),
        jurisdiction: z.string().max(64).optional(),
      })
      .parse(req.body);

    // Content-hash cache — same document analyzed twice within the TTL is
    // served from memory, saving a full Gemini round-trip.
    const cacheKey = createHash('sha256')
      .update(body.text + ':' + body.documentType + ':' + (body.jurisdiction ?? ''))
      .digest('hex');
    const cached = cache.get(cacheKey);
    if (cached) {
      reply.header('X-Lexguard-Cache', 'HIT');
      return reply.send({
        documentId: cached.documentId,
        result: cached,
        extractedText: body.text.slice(0, 60_000),
      });
    }

    const documentId = uuid();
    const raw = await analyzeDocument(getAi(), body.text, {
      documentId,
      documentType: body.documentType,
      jurisdiction: body.jurisdiction,
    });

    // Output validation — never trust untrusted upstreams. Zod-parse the
    // result so a misbehaving AI response can't poison the client.
    const result = analysisResultSchema.parse(raw) as AnalysisResult;
    cache.set(cacheKey, result);

    reply.header('X-Lexguard-Cache', 'MISS');
    return reply.send({
      documentId,
      result,
      extractedText: body.text.slice(0, 60_000),
    });
  });

  // ── POST /api/upload — file upload + analyze ───────────────────────
  app.post('/api/upload', async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.code(415).send({ error: 'Expected multipart/form-data' });
    }
    const file = await req.file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    if (!file) return reply.code(400).send({ error: 'No file uploaded' });

    const docType =
      (file.fields['documentType'] as { value?: string } | undefined)?.value ?? 'other';
    const jurisdiction =
      (file.fields['jurisdiction'] as { value?: string } | undefined)?.value;

    const meta = uploadMetadataSchema.parse({
      filename: file.filename,
      size: file.file.bytesRead || 1,
      mimeType: file.mimetype,
      documentType: documentTypeSchema.parse(docType),
    });

    const buffer = await file.toBuffer();
    const extracted = await extractText(buffer, meta.filename, meta.mimeType);

    // contentHash from extracted text means the same file (even uploaded as
    // a different filename) gets a cache hit.
    const cacheKey = extracted.contentHash + ':' + meta.documentType;
    const cached = cache.get(cacheKey);
    if (cached) {
      reply.header('X-Lexguard-Cache', 'HIT');
      return reply.send({
        documentId: cached.documentId,
        result: cached,
        extractedText: extracted.text.slice(0, 60_000),
      });
    }

    const documentId = uuid();
    const raw = await analyzeDocument(getAi(), extracted.text, {
      documentId,
      documentType: meta.documentType,
      jurisdiction,
    });
    const result = analysisResultSchema.parse(raw) as AnalysisResult;
    cache.set(cacheKey, result);

    reply.header('X-Lexguard-Cache', 'MISS');
    return reply.send({
      documentId,
      result,
      extractedText: extracted.text.slice(0, 60_000),
    });
  });

  // ── POST /api/analyze/stream — SSE-streamed analysis ───────────────
  app.post('/api/analyze/stream', async (req, reply) => {
    const body = z
      .object({
        text: z.string().min(50).max(250_000),
        documentType: documentTypeSchema.default('other'),
        jurisdiction: z.string().max(64).optional(),
      })
      .parse(req.body);

    // CRITICAL: writing to reply.raw bypasses Fastify's onSend hooks, so
    // CORS + CORP headers aren't applied automatically. We must set them
    // manually or the browser blocks the streamed response.
    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
    const reqOrigin = req.headers.origin as string | undefined;
    const corsOrigin =
      reqOrigin && allowedOrigins.includes(reqOrigin) ? reqOrigin : allowedOrigins[0]!;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': corsOrigin,
      'Cross-Origin-Resource-Policy': 'cross-origin',
      Vary: 'Origin',
    });

    const send = (event: AnalysisProgressEvent): void => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);

    try {
      const documentId = uuid();
      const result = await analyzeDocument(getAi(), body.text, {
        documentId,
        documentType: body.documentType,
        jurisdiction: body.jurisdiction,
        onProgress: send,
      });
      send({ type: 'completed', progress: 1, partial: result });
    } catch (err) {
      send({ type: 'error', error: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      reply.raw.end();
    }
    return reply;
  });

  app.get('/api/document-types', async () => ({ types: DOCUMENT_TYPES }));

  return app;
}

async function main(): Promise<void> {
  // Pull secrets from Secret Manager BEFORE env validation runs against
  // process.env. No-op locally — `K_SERVICE` is only set on Cloud Run.
  const resolvedSecrets = await loadSecretsFromGcp();
  if (resolvedSecrets.length > 0) {
    resetEnvCache();
    logger.info({ secrets: resolvedSecrets }, 'loaded secrets from Secret Manager');
  }

  const env = loadEnv();
  const app = await buildServer();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(
      { gemini: Boolean(geminiApiKey(env)), cloudRun: Boolean(process.env.K_SERVICE) },
      `LEXGUARD API listening on http://${env.HOST}:${env.PORT}`,
    );
  } catch (err) {
    logger.fatal({ err }, 'server_failed_to_start');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
