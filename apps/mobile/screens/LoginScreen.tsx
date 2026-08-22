import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Button, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { LoginSchema } from '@hotel/shared';
import { apiFetch, login } from '../lib/api';
import type { RootStackParamList } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// A real Expo push token comes from expo-notifications' getExpoPushTokenAsync().
// That native dep isn't wired here; we register a placeholder to exercise the flow.
async function registerThisDevice(): Promise<void> {
  const token = `ExponentPushToken[placeholder-${Date.now()}]`;
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  await apiFetch('/devices/register', { method: 'POST', body: { token, platform }, auth: true }).catch(() => undefined);
}

export function LoginScreen({ navigation }: Props) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  const signIn = useMutation({
    mutationFn: async () => {
      const body = LoginSchema.parse(form);
      await login(body.email, body.password);
      await registerThisDevice(); // subscribe this device to booking push events
    },
    onSuccess: () => navigation.replace('Account'),
    onError: (e) => setError((e as Error).message),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Sign in</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={signIn.isPending ? 'Signing in…' : 'Sign in'} onPress={() => { setError(null); signIn.mutate(); }} disabled={signIn.isPending} />
      <Text style={styles.muted}>Seeded: guest@hotel.test / password123</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  h1: { fontSize: 20, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  muted: { color: '#6b7280' },
  error: { color: '#b91c1c' },
});
