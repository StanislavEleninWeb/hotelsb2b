import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from './auth-user';

/** Inject the authenticated subject (req.user), or undefined if anonymous. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    return ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
  },
);

export const AUTHENTICATED_META = 'auth:authenticated';
/** Require ANY authenticated subject (staff or guest). */
export const Authenticated = () => SetMetadata(AUTHENTICATED_META, true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!req.user) throw new UnauthorizedException('Authentication required');
    return true;
  }
}
