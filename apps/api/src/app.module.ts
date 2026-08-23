import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import Redis from 'ioredis';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CacheModule } from './cache/cache.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { AiModule } from './modules/ai/ai.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/auth/roles.guard';
import { AuthModule } from './auth/auth.module';
import { AuthContextGuard } from './auth/guards/auth-context.guard';
import { PropertyScopeGuard } from './auth/guards/property-scope.guard';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RatePlansModule } from './modules/rate-plans/rate-plans.module';
import { GuestsModule } from './modules/guests/guests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Pretty logs only in local dev; structured JSON (for CloudWatch) everywhere
        // else — and no pino-pretty worker thread to leak in tests.
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
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
        // Single per-IP bucket; routes tighten it with @Throttle (search 20/min,
        // AI tool endpoints 30/min). A named global 'ai' throttler would apply to
        // ALL routes, so AI tightening is done per-route instead. NOTE: per-IP is a
        // weak backstop for AI (all traffic shares the provider's IP) — the real
        // limit is per-booking (AiService OTP counter, §5.5).
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
          }),
        ),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    PrismaModule,
    RedisModule,
    CacheModule,
    AuthModule,
    AvailabilityModule,
    BookingsModule,
    PropertiesModule,
    RoomsModule,
    RatePlansModule,
    GuestsModule,
    DevicesModule,
    NotificationsModule,
    SearchModule,
    AiModule,
  ],
  controllers: [AppController],
  // Global guard order matters and runs top-to-bottom:
  //   Throttler → AuthContext (populate req.user) → Roles (BFLA) →
  //   PropertyScope (BOLA) → Csrf (cookie sessions).
  providers: [
    // THROTTLE_DISABLED=1 removes the global rate limiter for LOCAL load testing.
    // Ignored in production so it can never disable rate limiting on a real deploy.
    ...(process.env.THROTTLE_DISABLED === '1' && process.env.NODE_ENV !== 'production'
      ? []
      : [{ provide: APP_GUARD, useClass: ThrottlerGuard }]),
    { provide: APP_GUARD, useClass: AuthContextGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PropertyScopeGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
