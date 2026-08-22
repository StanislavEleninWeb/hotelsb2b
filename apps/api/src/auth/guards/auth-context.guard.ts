import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../auth-user';
import { TokenService } from '../token.service';

/**
 * Global, OPTIONAL authentication. Populates req.user from a valid access token
 * (Bearer header or httpOnly cookie). Absent token → anonymous (public routes
 * work). Present but invalid/expired → 401 (so the client can tell "refresh me"
 * from "forbidden"). Never makes an authorization decision itself.
 */
@Injectable()
export class AuthContextGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extract(req);
    if (!token) return true;

    const payload = this.tokens.verifyAccessToken(token); // throws 401 if invalid
    // Only real access tokens establish a subject. Reject anything else (e.g. a
    // booking-action verification token) rather than defaulting it to a guest.
    if (payload.kind !== 'staff' && payload.kind !== 'guest') {
      throw new UnauthorizedException('Not an access token');
    }
    if (!payload.sub) throw new UnauthorizedException('Malformed access token');
    req.user =
      payload.kind === 'staff'
        ? { kind: 'staff', id: payload.sub, email: payload.email ?? '', role: payload.role! }
        : { kind: 'guest', id: payload.sub, email: payload.email ?? null };
    return true;
  }

  private extract(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return (req as Request & { cookies?: Record<string, string> }).cookies?.access_token;
  }
}
