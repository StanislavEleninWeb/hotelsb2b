import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { CreateBookingSchema, formatMoney, PrimaryGuestSchema } from '@hotel/shared';
import { apiFetch } from '../lib/api';
import type { BookingView, RootStackParamList } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Book'>;

export function BookScreen({ route }: Props) {
  const p = route.params;
  const [guest, setGuest] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  // Stable idempotency key per booking attempt (regenerated if the guest edits).
  const idempotencyKey = useMemo(() => `mob-${Date.now()}-${Math.round(Math.random() * 1e9)}`, [guest]);

  const create = useMutation({
    mutationFn: () => {
      const payload = CreateBookingSchema.parse({
        propertyId: p.propertyId,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        rooms: [{ roomTypeId: p.roomTypeId, ratePlanId: p.ratePlanId, adults: p.adults, children: p.children }],
        primaryGuest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          email: guest.email || undefined,
          phone: guest.phone || undefined,
        },
      });
      return apiFetch<BookingView>('/bookings', { method: 'POST', body: payload, idempotencyKey });
    },
  });

  function submit() {
    setError(null);
    const ok = PrimaryGuestSchema.safeParse({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email || undefined,
      phone: guest.phone || undefined,
    });
    if (!ok.success) {
      setError(ok.error.issues[0]?.message ?? 'Check your details.');
      return;
    }
    create.mutate();
  }

  if (create.data) {
    return (
      <View style={styles.container}>
        <Text style={styles.h1}>Booking received</Text>
        <Text>Confirmation code: {create.data.confirmationCode}</Text>
        <Text style={styles.muted}>
          Status: {create.data.status.replace('_', ' ').toLowerCase()} — awaiting payment confirmation.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{p.roomTypeName}</Text>
        <Text style={styles.muted}>{p.checkIn} → {p.checkOut}</Text>
        <Text style={styles.price}>{formatMoney(p.priceMinor, p.currency)} total</Text>
      </View>

      <TextInput style={styles.input} placeholder="First name" value={guest.firstName} onChangeText={(v) => setGuest({ ...guest, firstName: v })} />
      <TextInput style={styles.input} placeholder="Last name" value={guest.lastName} onChangeText={(v) => setGuest({ ...guest, lastName: v })} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={guest.email} onChangeText={(v) => setGuest({ ...guest, email: v })} />
      <TextInput style={styles.input} placeholder="Phone" value={guest.phone} onChangeText={(v) => setGuest({ ...guest, phone: v })} />

      <View style={styles.card}>
        <Text style={styles.muted}>
          Payment is entered in the provider’s hosted fields (mobile SDK) — never in our form (PB-05).
          Provider integration ships with the payment phase; this is a placeholder.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {create.isError ? <Text style={styles.error}>{(create.error as Error).message}</Text> : null}
      <Button title={create.isPending ? 'Placing…' : 'Place booking'} onPress={submit} disabled={create.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  h1: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#6b7280' },
  price: { fontWeight: '700', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, backgroundColor: '#fff' },
  error: { color: '#b91c1c' },
});
