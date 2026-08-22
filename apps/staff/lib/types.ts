export interface PropertySummary {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  currency: string;
}

export interface StaffBookingRoom {
  id: string;
  roomTypeId: string;
  roomId: string | null;
  priceMinor: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  roomType?: { name: string };
  room?: { number: string } | null;
  ratePlan?: { name: string; cancellationPolicy: string };
}

export interface StaffBooking {
  id: string;
  confirmationCode: string;
  status: string;
  currency: string;
  totalMinor: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  primaryGuest?: { firstName: string; lastName: string };
  primaryGuestId?: string;
  rooms: StaffBookingRoom[];
  property?: { name: string };
}

export interface StaffRoom {
  id: string;
  number: string;
  floor?: number | null;
  status: "CLEAN" | "DIRTY" | "INSPECTED" | "OUT_OF_SERVICE";
  roomTypeId: string;
  active: boolean;
  roomType?: { name: string };
}

export interface RoomBlock {
  id: string;
  roomId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  channel: string;
  actorUserId: string | null;
  actorGuestId: string | null;
  createdAt: string;
}

export interface RatePlan {
  id: string;
  name: string;
  cancellationPolicy: "REFUNDABLE" | "NON_REFUNDABLE";
  includesBreakfast: boolean;
  basePriceMinor: number;
  currency: string;
  active: boolean;
  roomTypeId: string;
}

export interface GuestProfile {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    isAccount: boolean;
    marketingOptIn: boolean;
    createdAt: string;
  };
  bookings: (StaffBooking & { property?: { name: string } })[];
  notes: { id: string; body: string; createdAt: string; propertyId: string | null }[];
}

export interface AuthUser {
  kind: "staff" | "guest";
  id: string;
  email: string | null;
  role?: string;
}
