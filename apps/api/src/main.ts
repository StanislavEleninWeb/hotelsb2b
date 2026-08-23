import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true preserves the exact request bytes so inbound webhook signatures
  // (AI provider, payment processor) can be HMAC-verified over what was actually sent.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  // Structured logging (pino) with per-request correlation ids.
  app.useLogger(app.get(Logger));

  // Parse cookies for cookie-based web sessions (auth + CSRF).
  app.use(cookieParser());

  // Baseline security headers on every API response (defense in depth; the JSON
  // API isn't framed or rendered, but these are cheap and correct).
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  // CORS for the browser clients (web :3000, staff :3001). credentials:true is
  // incompatible with a wildcard origin, so use an explicit allow-list, and
  // allow-list our custom request headers or the preflight strips them.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'Idempotency-Key',
      'X-Channel',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // API-first: every client hits the one versioned API. See CLAUDE.md invariant #7.
  app.setGlobalPrefix('api/v1');

  // Reject unknown fields, don't just strip them (Plan/02 §5.1, CLAUDE.md #3).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
}

void bootstrap();
