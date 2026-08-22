import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@hotel/shared';
import { ApiError, apiFetch, logout } from '../lib/api';
import type { BookingView, RootStackParamList } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

export function AccountScreen({ navigation }: Props) {
  const bookings = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => apiFetch<BookingView[]>('/bookings/mine', { auth: true }),
    retry: false,
  });

  if (bookings.isLoading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (bookings.isError) {
    const unauth = bookings.error instanceof ApiError && bookings.error.status === 401;
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{unauth ? 'Please sign in to view your bookings.' : (bookings.error as Error).message}</Text>
        <Button title="Sign in" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings.data ?? []}
        keyExtractor={(b) => b.id}
        ListEmptyComponent={<Text style={styles.muted}>No bookings yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.property?.name ?? 'Booking'}</Text>
            <Text style={styles.muted}>{item.checkIn} → {item.checkOut} · {item.status.replace('_', ' ').toLowerCase()}</Text>
            <Text style={styles.muted}>Confirmation {item.confirmationCode}</Text>
            <Text style={styles.price}>{formatMoney(item.totalMinor, item.currency)}</Text>
          </View>
        )}
      />
      <Button title="Sign out" onPress={async () => { await logout(); navigation.replace('Login'); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#6b7280' },
  price: { fontWeight: '700', marginTop: 4 },
  error: { color: '#b91c1c' },
});
