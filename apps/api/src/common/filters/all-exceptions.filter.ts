import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

// Central exception filter (§5.9). Clients get a generic message + correlation id;
// full stack traces / DB errors go only to the structured logs, never the response.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request & { id?: string }>();
    const correlationId = req.id?.toString();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Only expose safe, client-facing messages (validation errors, 4xx). Never
    // leak internal error text for 5xx.
    let message: string | string[] = 'Internal server error';
    if (isHttp) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);
    }

    if (!isHttp || status >= 500) {
      this.logger.error(
        `[${correlationId}] ${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(status).json({
      statusCode: status,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}
