import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { REDIS } from '../../redis/redis.module';

const MAX_SKEW_SECONDS = 300; // ±5 min timestamp tolerance
const NONCE_TTL_SECONDS = 600; // remember signatures long enough to cover the window

/**
 * Verifies inbound AI-provider webhooks (§5.4): HMAC-SHA256 over
 * `${timestamp}.${rawBody}` with the shared secret, a ±5-min timestamp window, AND
 * a one-time nonce (the signature itself) so a captured request can't be replayed
 * even inside the window. Fails CLOSED — missing header / raw body / secret → reject.
 */
@Injectable()
export class HmacSignatureGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();

    const secret = this.config.get<string>('AI_WEBHOOK_SECRET');
    if (!secret) throw new UnauthorizedException('Webhook verification not configured');

    const signature = this.header(req, 'x-ai-signature');
    const timestamp = this.header(req, 'x-ai-timestamp');
    if (!signature || !timestamp) throw new UnauthorizedException('Missing signature');

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_SKEW_SECONDS) {
      throw new UnauthorizedException('Stale or invalid timestamp');
    }

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      // Fails closed: without the exact bytes we can't verify. (rawBody: true in main.ts)
      throw new UnauthorizedException('Missing request body');
    }

    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Replay protection: the signature may be used exactly once.
    const fresh = await this.redis.set(`ai-nonce:${signature}`, '1', 'EX', NONCE_TTL_SECONDS, 'NX');
    if (!fresh) throw new UnauthorizedException('Replay detected');

    return true;
  }

  private header(req: Request, name: string): string | undefined {
    const v = req.headers[name];
    return Array.isArray(v) ? v[0] : v;
  }
}
