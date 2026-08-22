import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Channel } from '@prisma/client';
import type { Request } from 'express';

// Who/where an action came from — attached to audit logs and booking records.
// actorUserId (staff) is populated by the auth layer in Phase 4; until then it is
// undefined for public requests.
export interface ActionContext {
  channel: Channel;
  actorUserId?: string;
  actorGuestId?: string;
  correlationId?: string;
  ipAddress?: string;
}

function parseChannel(raw: unknown): Channel {
  const value = String(raw ?? '').toUpperCase();
  return (Object.values(Channel) as string[]).includes(value)
    ? (value as Channel)
    : Channel.WEB;
}

/** Build an ActionContext from the incoming request. */
export function contextFromRequest(req: Request): ActionContext {
  const user = (req as Request & { user?: { id?: string } }).user;
  return {
    channel: parseChannel(req.headers['x-channel']),
    actorUserId: user?.id,
    correlationId: (req as Request & { id?: string }).id?.toString(),
    ipAddress: req.ip,
  };
}

/** @Ctx() controller param decorator → ActionContext. */
export const Ctx = createParamDecorator((_data: unknown, ctx: ExecutionContext): ActionContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return contextFromRequest(req);
});
