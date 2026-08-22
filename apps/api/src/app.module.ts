import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/auth/roles.guard';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RatePlansModule } from './modules/rate-plans/rate-plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Pretty logs in dev; structured JSON (for CloudWatch) in prod.
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        // Correlation id per request; honor an inbound X-Request-Id if present.
        genReqId: (req, res) => {
          const existing = req.headers['x-request-id'];
          const id = (Array.isArray(existing) ? existing[0] : existing) ?? crypto.randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    // Redis-backed rate limiting. Stricter per-endpoint limits (search/availability,
    // booking lookup) are set with @Throttle on those routes (§5.5).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
          }),
        ),
      }),
    }),
    PrismaModule,
    RedisModule,
    AvailabilityModule,
    BookingsModule,
    PropertiesModule,
    RoomsModule,
    RatePlansModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
