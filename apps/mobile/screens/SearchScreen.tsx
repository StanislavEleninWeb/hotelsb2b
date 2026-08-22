import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatMoney, SearchQuerySchema } from '@hotel/shared';
import { apiFetch } from '../lib/api';
import type { RootStackParamList, SearchRow } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;

function isoIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SearchScreen({ navigation }: Props) {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState(isoIn(14));
  const [checkOut, setCheckOut] = useState(isoIn(16));
  const [query, setQuery] = useState<{ checkIn: string; checkOut: string; adults: number; children: number; destination: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ['search', query],
    enabled: query !== null,
    queryFn: () => {
      const qs = new URLSearchParams({
        checkIn: query!.checkIn,
        checkOut: query!.checkOut,
        adults: String(query!.adults),
        children: String(query!.children),
      });
      if (query!.destination) qs.set('destination', query!.destination);
      return apiFetch<SearchRow[]>(`/search?${qs}`);
    },
  });

  function submit() {
    setError(null);
    const parsed = SearchQuerySchema.safeParse({ destination: destination || undefined, checkIn, checkOut, adults: 2, children: 0 });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your dates.');
      return;
    }
    setQuery({ checkIn, checkOut, adults: 2, children: 0, destination });
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Destination (optional)" value={destination} onChangeText={setDestination} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.flex]} placeholder="Check-in YYYY-MM-DD" value={checkIn} onChangeText={setCheckIn} autoCapitalize="none" />
        <TextInput style={[styles.input, styles.flex]} placeholder="Check-out YYYY-MM-DD" value={checkOut} onChangeText={setCheckOut} autoCapitalize="none" />
      </View>
      <Button title="Search" onPress={submit} />
      <Button title="My bookings" onPress={() => navigation.navigate('Account')} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {results.isFetching ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      <FlatList
        data={results.data ?? []}
        keyExtractor={(r) => r.property.id}
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => {
          const cheapest = item.availability.flatMap((a) => a.ratePlans).sort((x, y) => x.priceMinor - y.priceMinor)[0];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('Property', { slug: item.property.slug, checkIn: query!.checkIn, checkOut: query!.checkOut, adults: 2, children: 0 })}
            >
              <Text style={styles.title}>{item.property.name}</Text>
              {item.property.city ? <Text style={styles.muted}>{item.property.city}</Text> : null}
              <Text style={styles.price}>
                {cheapest ? `from ${formatMoney(cheapest.priceMinor, cheapest.currency)}` : 'No availability'}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginBottom: 10, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: '700' },
  muted: { color: '#6b7280' },
  price: { fontWeight: '700', marginTop: 4 },
  error: { color: '#b91c1c' },
});
