import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defense for COOKIE-authenticated, state-changing requests (double-submit
 * token, on top of SameSite=Lax session cookies). Bearer-token clients (mobile/API)
 * are naturally CSRF-immune and are skipped, as are safe methods and anonymous
 * requests. The web app reads the non-httpOnly `csrf_token` cookie and echoes it in
 * the `X-CSRF-Token` header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { cookies?: Record<string, string> }>();
    if (SAFE_METHODS.has(req.method)) return true;

    const usesBearer = req.headers.authorization?.startsWith('Bearer ') ?? false;
    const accessCookie = req.cookies?.access_token;
    if (usesBearer || !accessCookie) return true; // not a cookie session → CSRF N/A

    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies?.csrf_token;
    if (!cookieToken || !headerToken || headerToken !== cookieToken) {
      throw new ForbiddenException('CSRF token missing or invalid');
    }
    return true;
  }
}
