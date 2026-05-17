import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export async function errorHandler(
  error: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'ValidationError',
      issues: error.flatten().fieldErrors,
    });
  }

  const fastifyErr = error as FastifyError;
  const status = fastifyErr.statusCode ?? 500;

  // Don't leak stack traces to clients in production.
  const body =
    status >= 500
      ? { error: 'Internal server error', requestId: req.id }
      : { error: error.message, requestId: req.id };

  if (status >= 500) {
    logger.error({ err: error, req: { id: req.id, url: req.url } }, 'request_failed');
  }

  return reply.code(status).send(body);
}
