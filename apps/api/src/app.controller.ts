import { Controller, Get } from '@nestjs/common';
import { HealthResponseSchema, type HealthResponse } from '@hotel/shared';

@Controller('health')
export class AppController {
  // GET /api/v1/health — validates its own response against the shared schema,
  // proving @hotel/shared (built CJS) imports cleanly into NestJS.
  @Get()
  health(): HealthResponse {
    return HealthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    });
  }
}
