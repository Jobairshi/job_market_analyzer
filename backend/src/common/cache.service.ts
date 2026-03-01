import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../config/redis.constants';

/**
 * CacheService — thin Redis wrapper with automatic in-memory fallback.
 *
 * TTL strategy:
 *   - Market analytics → 600s (10 min)
 *   - AI results       → 3600s (1 hour)
 *   - Salary pred      → 21600s (6 hours)
 *   - Heatmap          → 600s (10 min)
 *   - Nearby jobs      → 300s (5 min)
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private fallback = new Map<string, { data: string; expiresAt: number }>();
  private redisAvailable = true;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.redis.on('error', () => {
      if (this.redisAvailable) {
        this.logger.warn('Redis unavailable — using in-memory fallback');
        this.redisAvailable = false;
      }
    });
    this.redis.on('connect', () => {
      this.redisAvailable = true;
    });
  }

  /** Get cached value (returns null on miss). */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.redisAvailable) {
        const val = await this.redis.get(key);
        return val ? (JSON.parse(val) as T) : null;
      }
    } catch {
      // fall through to in-memory
    }

    const entry = this.fallback.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return JSON.parse(entry.data) as T;
    }
    this.fallback.delete(key);
    return null;
  }

  /** Set cached value with TTL in seconds. */
  async set(key: string, value: unknown, ttl: number): Promise<void> {
    const json = JSON.stringify(value);
    try {
      if (this.redisAvailable) {
        await this.redis.setex(key, ttl, json);
        return;
      }
    } catch {
      // fall through
    }
    this.fallback.set(key, { data: json, expiresAt: Date.now() + ttl * 1000 });
  }

  /** Delete a cached key. */
  async del(key: string): Promise<void> {
    try {
      if (this.redisAvailable) {
        await this.redis.del(key);
      }
    } catch {
      // ignore
    }
    this.fallback.delete(key);
  }

  /** Delete all keys matching a pattern. */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.redisAvailable) {
        const keys = await this.redis.keys(pattern);
        if (keys.length) await this.redis.del(...keys);
      }
    } catch {
      // ignore
    }
    // In-memory: delete matching keys
    for (const k of this.fallback.keys()) {
      if (k.includes(pattern.replace('*', ''))) {
        this.fallback.delete(k);
      }
    }
  }
}
