import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessTokenPayload, AuthUser } from './auth-user';

const ACCESS_TTL = '15m';
const REFRESH_TTL_DAYS = 30;
const GRACE_MS = 10_000; // parallel-client rotation race window

export interface RefreshContext {
  userAgent?: string;
  ipAddress?: string;
}

type Subject = { kind: 'staff'; id: string } | { kind: 'guest'; id: string };

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private accessSecret(): string {
    return this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';
  }

  issueAccessToken(user: AuthUser): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      kind: user.kind,
      role: user.kind === 'staff' ? user.role : undefined,
      email: user.email,
    };
    return this.jwt.sign(payload, { secret: this.accessSecret(), expiresIn: ACCESS_TTL });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return this.jwt.verify<AccessTokenPayload>(token, { secret: this.accessSecret() });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Issue a fresh refresh token (new rotation family unless one is supplied). */
  async issueRefreshToken(subject: Subject, ctx: RefreshContext, family?: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(raw),
        family: family ?? randomUUID(),
        expiresAt,
        userId: subject.kind === 'staff' ? subject.id : null,
        guestId: subject.kind === 'guest' ? subject.id : null,
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
    });
    return raw;
  }

  /**
   * Rotate a refresh token. Reuse of an already-rotated token (outside the grace
   * window) revokes the whole family — token-theft detection. Within the grace
   * window a replayed token is treated as a benign parallel-client race and a fresh
   * token is issued without revoking the family.
   */
  async rotate(raw: string, ctx: RefreshContext): Promise<{ subject: Subject; refresh: string }> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(raw) },
    });
    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existing.revokedAt) {
      const replacedRecently = Date.now() - existing.revokedAt.getTime() < GRACE_MS;
      if (!replacedRecently) {
        // Reuse of a fully-rotated token → assume theft, revoke the lineage.
        await this.revokeFamily(existing.family);
        throw new UnauthorizedException('Refresh token reuse detected');
      }
    }

    const subject: Subject = existing.userId
      ? { kind: 'staff', id: existing.userId }
      : { kind: 'guest', id: existing.guestId! };

    const refresh = await this.issueRefreshToken(subject, ctx, existing.family);
    if (!existing.revokedAt) {
      const replacement = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: this.hashToken(refresh) },
      });
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), replacedById: replacement?.id ?? null },
      });
    }
    return { subject, refresh };
  }

  async revokeFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeByRaw(raw: string): Promise<void> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(raw) },
    });
    if (token) await this.revokeFamily(token.family);
  }
}
