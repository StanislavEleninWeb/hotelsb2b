import { ConflictException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

const RESULT_TTL_SECONDS = 60 * 60 * 24; // 24h
const LOCK_TTL_SECONDS = 60;

interface StoredResult {
  fingerprint: string;
  value: unknown;
}

/**
 * Idempotency-Key support for write endpoints (booking creation). A repeated
 * request with the same key returns the original result instead of acting twice —
 * mobile/AI clients retry on dropped connections (Plan/02 §2). The stored result
 * is bound to a fingerprint of the request (route + body): reusing a key with a
 * different payload is rejected (422), never silently served the wrong result.
 */
@Injectable()
export class IdempotencyService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  static fingerprint(parts: unknown): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  async execute<T>(
    key: string | undefined,
    fingerprint: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!key) return fn();

    const resultKey = `idem:res:${key}`;
    const lockKey = `idem:lock:${key}`;

    const cached = await this.redis.get(resultKey);
    if (cached) return this.decodeOrReject<T>(cached, fingerprint);

    const acquired = await this.redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    if (!acquired) {
      const raced = await this.redis.get(resultKey);
      if (raced) return this.decodeOrReject<T>(raced, fingerprint);
      throw new ConflictException('A request with this Idempotency-Key is already in progress');
    }

    try {
      const value = await fn();
      const stored: StoredResult = { fingerprint, value };
      await this.redis.set(resultKey, JSON.stringify(stored), 'EX', RESULT_TTL_SECONDS);
      return value;
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private decodeOrReject<T>(raw: string, fingerprint: string): T {
    const stored = JSON.parse(raw) as StoredResult;
    if (stored.fingerprint !== fingerprint) {
      throw new UnprocessableEntityException(
        'Idempotency-Key was already used with a different request payload',
      );
    }
    return stored.value as T;
  }
}
