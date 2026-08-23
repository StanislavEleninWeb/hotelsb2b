export interface PropertySummary {
  id: string;
  slug: string;
  name: string;
  city?: string | null;
  currency: string;
  description?: string | null;
}

export interface RatePlan {
  id: string;
  name: string;
  cancellationPolicy: 'REFUNDABLE' | 'NON_REFUNDABLE';
  includesBreakfast: boolean;
  basePriceMinor: number;
  currency: string;
}

export interface RoomTypeDetail {
  id: string;
  name: string;
  description?: string | null;
  bedConfig?: string | null;
  maxAdults: number;
  maxChildren: number;
  ratePlans: RatePlan[];
}

export interface PropertyDetail extends PropertySummary {
  roomTypes: RoomTypeDetail[];
}

export interface AvailabilityResult {
  roomTypeId: string;
  roomTypeName: string;
  availableRooms: number;
  ratePlans: { ratePlanId: string; name: string; priceMinor: number; currency: string }[];
}

export interface SearchRow {
  property: PropertySummary;
  availability: AvailabilityResult[];
}

export interface BookingView {
  id: string;
  confirmationCode: string;
  status: string;
  currency: string;
  totalMinor: number;
  checkIn: string;
  checkOut: string;
  property?: { name: string };
  rooms: { id: string; roomType?: { name: string } }[];
}

export type RootStackParamList = {
  Search: undefined;
  Property: { slug: string; checkIn: string; checkOut: string; adults: number; children: number };
  Book: {
    propertyId: string;
    roomTypeId: string;
    ratePlanId: string;
    roomTypeName: string;
    priceMinor: number;
    currency: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
  };
  Account: undefined;
  Login: undefined;
};
