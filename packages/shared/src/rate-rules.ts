// Single source of truth for the RateRule.daysOfWeek bitmask (Prisma schema uses
// an Int; the bit convention lives here so the API and staff UI agree). Bit i is
// set when the rule applies on that day. Monday = bit 0 … Sunday = bit 6.
export const DAY_OF_WEEK_BIT = {
  MON: 1 << 0,
  TUE: 1 << 1,
  WED: 1 << 2,
  THU: 1 << 3,
  FRI: 1 << 4,
  SAT: 1 << 5,
  SUN: 1 << 6,
} as const;

export const ALL_DAYS = 0b1111111; // 127 — every day

/** JS Date.getDay(): 0=Sun..6=Sat → our Mon=0..Sun=6 bit index. */
export function dayOfWeekBit(date: Date): number {
  const jsDay = date.getDay(); // 0=Sun
  const monIndex = (jsDay + 6) % 7; // 0=Mon
  return 1 << monIndex;
}

/** True if a rule's daysOfWeek bitmask applies on the given date. */
export function ruleAppliesOn(daysOfWeekMask: number, date: Date): boolean {
  return (daysOfWeekMask & dayOfWeekBit(date)) !== 0;
}
