import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertTransition, canTransition } from './booking-state-machine';

describe('Booking state machine', () => {
  it('allows the legal lifecycle transitions', () => {
    expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED)).toBe(true);
    expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN)).toBe(true);
    expect(canTransition(BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT)).toBe(true);
    expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.NO_SHOW)).toBe(true);
    expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.CANCELLED)).toBe(true);
    // Early departure / dispute: an in-house booking can be cancelled by staff.
    expect(canTransition(BookingStatus.CHECKED_IN, BookingStatus.CANCELLED)).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED)).toBe(false);
    expect(canTransition(BookingStatus.CANCELLED, BookingStatus.CONFIRMED)).toBe(false);
    expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.CHECKED_IN)).toBe(false);
    expect(canTransition(BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED)).toBe(false);
  });

  it('assertTransition throws on an illegal move', () => {
    expect(() => assertTransition(BookingStatus.CHECKED_OUT, BookingStatus.CONFIRMED)).toThrow(
      BadRequestException,
    );
  });
});
