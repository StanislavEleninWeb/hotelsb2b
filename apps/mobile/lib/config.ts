// EXPO_PUBLIC_* vars are inlined at build time. Default to local dev.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
