// Lightweight views of the API responses the web app consumes.
export interface PropertySummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  city?: string | null;
  countryCode?: string | null;
  currency: string;
}

export interface RatePlan {
  id: string;
  name: string;
  cancellationPolicy: "REFUNDABLE" | "NON_REFUNDABLE";
  includesBreakfast: boolean;
  basePriceMinor: number;
  currency: string;
}

export interface RoomTypeDetail {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  maxAdults: number;
  maxChildren: number;
  bedConfig?: string | null;
  images: { url: string; alt?: string | null }[];
  ratePlans: RatePlan[];
}

export interface PropertyDetail extends PropertySummary {
  images: { url: string; alt?: string | null }[];
  amenities: { amenity: { code: string; name: string; category?: string | null } }[];
  roomTypes: RoomTypeDetail[];
}

export interface AvailabilityResult {
  roomTypeId: string;
  roomTypeName: string;
  availableRooms: number;
  ratePlans: { ratePlanId: string; name: string; priceMinor: number; currency: string }[];
}

export interface BookingRoomView {
  id: string;
  roomTypeId: string;
  ratePlanId: string;
  priceMinor: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  roomType?: { name: string };
  ratePlan?: { name: string; cancellationPolicy: string; refundableUntilHrs?: number | null };
}

export interface BookingView {
  id: string;
  confirmationCode: string;
  status: string;
  currency: string;
  totalMinor: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  specialRequests?: string | null;
  rooms: BookingRoomView[];
  property?: { name: string; checkInTime?: string | null; checkOutTime?: string | null };
}

export interface CancellationPreview {
  currency: string;
  totalMinor: number;
  refundableMinor: number;
  nonRefundableMinor: number;
  rooms: { bookingRoomId: string; policy: string; priceMinor: number; refundableMinor: number }[];
}

export interface AuthUser {
  kind: "staff" | "guest";
  id: string;
  email: string | null;
}
