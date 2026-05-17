import pino, { type LoggerOptions } from 'pino';
import { loadEnv } from '../config/env.js';

const env = loadEnv();

// Cloud Run sets K_SERVICE to the service name. We use it as the single source
// of truth for "am I running on Cloud Run" — never accidentally true in dev.
const onCloudRun = Boolean(process.env.K_SERVICE);

// Pino emits `level` as a number (10..60). Cloud Logging expects a `severity`
// string field on each log line so it can colour/filter entries correctly in
// the Logs Explorer. The mapping below mirrors Google's docs:
//   https://cloud.google.com/logging/docs/agent/logging/configuration#special-fields
const PINO_LEVEL_TO_GCP_SEVERITY: Record<number, string> = {
  10: 'DEBUG', // trace
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARNING',
  50: 'ERROR',
  60: 'CRITICAL',
};

const cloudRunOpts: LoggerOptions = {
  messageKey: 'message', // Cloud Logging's preferred message field
  formatters: {
    level(label, number) {
      return { severity: PINO_LEVEL_TO_GCP_SEVERITY[number] ?? 'DEFAULT', level: label };
    },
    log(obj) {
      // Surface req.id and err.stack into top-level fields Cloud Logging indexes.
      const o = obj as Record<string, unknown> & { err?: { stack?: string } };
      if (o.err?.stack) o['stack_trace'] = o.err.stack;
      return o;
    },
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
};

const devOpts: LoggerOptions = {
  transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } },
};

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.GEMINI_API_KEY',
      '*.GROQ_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  ...(onCloudRun ? cloudRunOpts : env.NODE_ENV === 'development' ? devOpts : {}),
});

if (onCloudRun) {
  logger.info(
    { service: process.env.K_SERVICE, revision: process.env.K_REVISION },
    'logger initialised in Cloud Run mode (structured severity)',
  );
}
