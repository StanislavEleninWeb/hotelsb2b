import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

const RESULT_TTL_SECONDS = 60 * 60 * 24; // 24h
const LOCK_TTL_SECONDS = 60;

/**
 * Idempotency-Key support for write endpoints (booking creation). A repeated
 * request with the same key returns the original result instead of acting twice —
 * mobile/AI clients retry on dropped connections (Plan/02 §2).
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async execute<T>(key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn();

    const resultKey = `idem:res:${key}`;
    const lockKey = `idem:lock:${key}`;

    const cached = await this.redis.get(resultKey);
    if (cached) return JSON.parse(cached) as T;

    const acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      const raced = await this.redis.get(resultKey);
      if (raced) return JSON.parse(raced) as T;
      throw new ConflictException('A request with this Idempotency-Key is already in progress');
    }

    try {
      const result = await fn();
      await this.redis.set(resultKey, JSON.stringify(result), 'EX', RESULT_TTL_SECONDS);
      return result;
    } finally {
      await this.redis.del(lockKey);
    }
  }
}
