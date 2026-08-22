import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Structured logging (pino) with per-request correlation ids.
  app.useLogger(app.get(Logger));

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
