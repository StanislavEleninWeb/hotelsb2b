import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;

/**
 * Per-identifier failure tracking + lockout for auth endpoints (§5.5). Keys are
 * an identifier (email / booking id) — not just IP — so distributed credential
 * stuffing against one account is caught. Exponential-ish: N failures within the
 * window trigger a fixed lockout that the caller must wait out.
 */
@Injectable()
export class AuthLockoutService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private failKey(id: string): string {
    return `auth:fail:${id}`;
  }
  private lockKey(id: string): string {
    return `auth:lock:${id}`;
  }

  async assertNotLocked(identifier: string): Promise<void> {
    const ttl = await this.redis.ttl(this.lockKey(identifier));
    if (ttl > 0) {
      throw new HttpException(
        `Too many attempts. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.failKey(identifier);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, WINDOW_SECONDS);
    if (count >= MAX_FAILURES) {
      await this.redis.set(this.lockKey(identifier), '1', 'EX', LOCKOUT_SECONDS);
      await this.redis.del(key);
    }
  }

  async clear(identifier: string): Promise<void> {
    await this.redis.del(this.failKey(identifier), this.lockKey(identifier));
  }
}
