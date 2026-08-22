import { z } from "zod";

// Zod schemas mirroring the API DTOs so web/mobile forms validate against the
// exact shapes the server enforces (client validation is UX; the API re-validates).

export const SearchQuerySchema = z
  .object({
    destination: z.string().max(120).optional(),
    checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    adults: z.coerce.number().int().min(1).max(20),
    children: z.coerce.number().int().min(0).max(20),
  })
  .refine((v) => v.checkOut > v.checkIn, { message: "checkOut must be after checkIn", path: ["checkOut"] });
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const PrimaryGuestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
});
export type PrimaryGuest = z.infer<typeof PrimaryGuestSchema>;

export const CreateBookingSchema = z.object({
  propertyId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rooms: z
    .array(
      z.object({
        roomTypeId: z.string().uuid(),
        ratePlanId: z.string().uuid(),
        adults: z.number().int().min(1),
        children: z.number().int().min(0),
      }),
    )
    .min(1),
  primaryGuest: PrimaryGuestSchema,
  specialRequests: z.string().max(1000).optional(),
});
export type CreateBooking = z.infer<typeof CreateBookingSchema>;

export const GuestRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});
export type GuestRegister = z.infer<typeof GuestRegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});
export type Login = z.infer<typeof LoginSchema>;

// AI assistant tool payloads. Validated with Zod (not class-validator) so the
// global forbidNonWhitelisted pipe doesn't reject provider envelope metadata —
// Zod strips unknown keys by default. Same shapes the web/staff API enforces.
export const AiAvailabilitySchema = z.object({
  propertyId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  adults: z.coerce.number().int().min(1).max(20).default(2),
  children: z.coerce.number().int().min(0).max(20).default(0),
});
export type AiAvailability = z.infer<typeof AiAvailabilitySchema>;

export const AiOtpRequestSchema = z.object({
  confirmationCode: z.string().min(1).max(20),
  lastName: z.string().min(1).max(100),
});

export const AiOtpVerifySchema = z.object({
  bookingId: z.string().uuid(),
  code: z.string().length(6),
});

export const AiBookingActionSchema = z.object({
  verificationToken: z.string().min(1).max(2000),
  reason: z.string().max(500).optional(),
});
