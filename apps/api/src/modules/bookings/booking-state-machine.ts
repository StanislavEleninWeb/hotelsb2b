import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

// Allowed booking status transitions (BK state machine). Anything not listed is
// rejected — invalid transitions can't be represented.
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  CONFIRMED: [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  CHECKED_IN: [BookingStatus.CHECKED_OUT],
  CHECKED_OUT: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingStatus, to: BookingStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(`Illegal booking transition: ${from} → ${to}`);
  }
}
