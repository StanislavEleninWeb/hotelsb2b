import * as SecureStore from 'expo-secure-store';

// Bearer tokens live in the device secure enclave (Keychain / Keystore), never
// AsyncStorage. Matches the Phase-4 bearer flow (access ~15m + rotating refresh).
const ACCESS_KEY = 'hs_access_token';
const REFRESH_KEY = 'hs_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
