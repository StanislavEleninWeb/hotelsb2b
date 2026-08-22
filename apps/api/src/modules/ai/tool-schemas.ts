// JSON-Schema tool definitions the ElevenLabs Conversational AI agent is configured
// with. Their `properties` mirror the same DTOs the web/staff API uses so validation
// is identical everywhere (AI-08 / invariant #6). Served at GET /api/v1/ai/tools.

export const AI_TOOLS = [
  {
    name: 'check_availability',
    description: 'Check room availability and prices for a property and date range.',
    url: '/api/v1/ai/availability',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['propertyId', 'checkIn', 'checkOut'],
      properties: {
        propertyId: { type: 'string', format: 'uuid' },
        checkIn: { type: 'string', description: 'YYYY-MM-DD' },
        checkOut: { type: 'string', description: 'YYYY-MM-DD' },
        adults: { type: 'integer', minimum: 1, default: 2 },
        children: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  },
  {
    name: 'create_booking',
    description: 'Create a booking. Confirm all details with the caller before calling this (BK-12).',
    url: '/api/v1/ai/bookings',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['propertyId', 'checkIn', 'checkOut', 'rooms', 'primaryGuest'],
      properties: {
        propertyId: { type: 'string', format: 'uuid' },
        checkIn: { type: 'string' },
        checkOut: { type: 'string' },
        rooms: {
          type: 'array',
          items: {
            type: 'object',
            required: ['roomTypeId', 'ratePlanId', 'adults', 'children'],
            properties: {
              roomTypeId: { type: 'string', format: 'uuid' },
              ratePlanId: { type: 'string', format: 'uuid' },
              adults: { type: 'integer', minimum: 1 },
              children: { type: 'integer', minimum: 0 },
            },
          },
        },
        primaryGuest: {
          type: 'object',
          required: ['firstName', 'lastName'],
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
          },
        },
      },
    },
  },
  {
    name: 'request_booking_otp',
    description:
      'Start identity verification: given a confirmation code + last name, send a one-time code to the contact ON FILE. Required before disclosing or changing a booking (AI-03).',
    url: '/api/v1/ai/otp/request',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['confirmationCode', 'lastName'],
      properties: {
        confirmationCode: { type: 'string' },
        lastName: { type: 'string' },
      },
    },
  },
  {
    name: 'verify_booking_otp',
    description: 'Verify the one-time code and receive a short-lived verification token.',
    url: '/api/v1/ai/otp/verify',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['bookingId', 'code'],
      properties: {
        bookingId: { type: 'string', format: 'uuid' },
        code: { type: 'string' },
      },
    },
  },
  {
    name: 'get_booking',
    description: 'Retrieve booking details + cancellation refund preview. Requires a verification token.',
    url: '/api/v1/ai/bookings/get',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['verificationToken'],
      properties: { verificationToken: { type: 'string' } },
    },
  },
  {
    name: 'cancel_booking',
    description:
      'Cancel a booking after telling the caller the refund amount (from get_booking). Requires a verification token.',
    url: '/api/v1/ai/bookings/cancel',
    method: 'POST',
    parameters: {
      type: 'object',
      required: ['verificationToken'],
      properties: {
        verificationToken: { type: 'string' },
        reason: { type: 'string' },
      },
    },
  },
] as const;
