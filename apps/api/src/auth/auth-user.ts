import { StaffRole } from '@prisma/client';

// The authenticated subject attached to req.user by AuthContextGuard.
export type AuthUser =
  | { kind: 'staff'; id: string; email: string; role: StaffRole }
  | { kind: 'guest'; id: string; email: string | null };

export interface AccessTokenPayload {
  sub: string;
  kind: 'staff' | 'guest';
  role?: StaffRole;
  email?: string | null;
}
