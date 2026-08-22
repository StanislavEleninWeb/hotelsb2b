import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/**
 * Availability/search cache (Plan/02 §3). Correctness comes from a per-property
 * VERSION counter baked into the cache key: any write that changes a search input
 * (Room, RoomType, RatePlan, RateRule, BookingRoom, RoomBlock for that property)
 * calls `bumpProperty`, which increments the version so old keys become unreachable
 * — no SCAN/DEL, race-safe. The read path (search) is the ONLY caller that reads
 * the cache; the concurrency-safe reserve path never does.
 */
@Injectable()
export class CacheService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async propertyVersion(propertyId: string): Promise<number> {
    return Number((await this.redis.get(`avail-ver:${propertyId}`)) ?? 0);
  }

  async bumpProperty(propertyId: string): Promise<void> {
    await this.redis.incr(`avail-ver:${propertyId}`);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }
}
