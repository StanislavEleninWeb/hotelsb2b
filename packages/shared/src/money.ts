import { z } from "zod";

// Money is ALWAYS an integer amount in the currency's minor unit plus the ISO
// currency code — never a float, never a bare "cents" field, because the minor
// exponent varies by currency (JPY=0, KWD=3). See CLAUDE.md invariant #1.
export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3).toUpperCase(),
});

export type Money = z.infer<typeof MoneySchema>;
