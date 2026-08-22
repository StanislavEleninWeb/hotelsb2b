// Payment provider boundary. NO card data ever touches our forms (PB-05): the real
// implementation (Phase 8) mounts the processor's HOSTED fields (Stripe Elements)
// and confirmation happens via a signature-verified server webhook — never a
// client-reported success (invariant #8). This interface lets the stub be swapped
// for Stripe without touching the booking flow.

export interface PaymentInitInput {
  bookingId: string;
  amountMinor: number;
  currency: string;
}

export interface PaymentInitResult {
  provider: string;
  // In the real impl this is the client secret used to mount hosted fields.
  clientSecret: string | null;
}

export interface PaymentProvider {
  readonly name: string;
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
}

// Phase 5 stub: collects nothing, confirms nothing. The booking stays
// PENDING_PAYMENT until the Phase 8 payment webhook confirms it.
export const stubPaymentProvider: PaymentProvider = {
  name: "stub",
  async init() {
    return { provider: "stub", clientSecret: null };
  },
};
