import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from '../common/cache.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

/**
 * RedisModule — global provider for ioredis.
 *
 * Falls back to an in-memory Map if Redis is unavailable,
 * so the app still works without Redis running.
 */
@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const url = config.get<string>('REDIS_URL') || 'redis://localhost:6379';

        const redis = new Redis(url, {
          maxRetriesPerRequest: 2,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn('Redis unavailable — falling back to in-memory cache');
              return null; // stop reconnecting
            }
            return Math.min(times * 200, 2000);
          },
          lazyConnect: true,
        });

        redis.connect().catch(() => {
          logger.warn('Redis connection failed — using in-memory fallback');
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule {}
