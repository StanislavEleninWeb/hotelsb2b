import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@hotel/shared';
import { apiFetch } from '../lib/api';
import type { AvailabilityResult, PropertyDetail, RootStackParamList } from '../lib/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Property'>;

export function PropertyScreen({ route, navigation }: Props) {
  const { slug, checkIn, checkOut, adults, children } = route.params;

  const property = useQuery({
    queryKey: ['property', slug],
    queryFn: () => apiFetch<PropertyDetail>(`/properties/by-slug/${encodeURIComponent(slug)}`),
  });

  const availability = useQuery({
    queryKey: ['availability', property.data?.id, checkIn, checkOut, adults, children],
    enabled: Boolean(property.data?.id),
    queryFn: () => {
      const qs = new URLSearchParams({ propertyId: property.data!.id, checkIn, checkOut, adults: String(adults), children: String(children) });
      return apiFetch<AvailabilityResult[]>(`/availability?${qs}`);
    },
  });

  if (property.isLoading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (property.isError) return <Text style={styles.error}>Could not load property.</Text>;

  const p = property.data!;
  const availByType = new Map(availability.data?.map((a) => [a.roomTypeId, a]));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{p.name}</Text>
      {p.city ? <Text style={styles.muted}>{p.city}</Text> : null}
      {p.description ? <Text style={styles.body}>{p.description}</Text> : null}

      {p.roomTypes.map((rt) => {
        const avail = availByType.get(rt.id);
        return (
          <View key={rt.id} style={styles.card}>
            <Text style={styles.title}>{rt.name}</Text>
            {rt.bedConfig ? <Text style={styles.muted}>{rt.bedConfig}</Text> : null}
            {rt.ratePlans.map((rp) => {
              const live = avail?.ratePlans.find((x) => x.ratePlanId === rp.id);
              const soldOut = !avail || avail.availableRooms === 0;
              return (
                <View key={rp.id} style={styles.rateRow}>
                  <View style={{ flex: 1 }}>
                    <Text>{rp.name}</Text>
                    <Text style={styles.muted}>
                      {rp.cancellationPolicy === 'REFUNDABLE' ? 'Free cancellation' : 'Non-refundable'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.price}>
                      {live ? `${formatMoney(live.priceMinor, live.currency)}` : `${formatMoney(rp.basePriceMinor, rp.currency)}/night`}
                    </Text>
                    <Button
                      title={soldOut ? 'Sold out' : 'Book'}
                      disabled={soldOut || !live}
                      onPress={() =>
                        navigation.navigate('Book', {
                          propertyId: p.id,
                          roomTypeId: rt.id,
                          ratePlanId: rp.id,
                          roomTypeName: rt.name,
                          priceMinor: live!.priceMinor,
                          currency: live!.currency,
                          checkIn,
                          checkOut,
                          adults,
                          children,
                        })
                      }
                    />
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  h1: { fontSize: 20, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  body: { marginVertical: 6 },
  muted: { color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 14, marginTop: 10, backgroundColor: '#fff' },
  rateRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8, marginTop: 8, gap: 8 },
  price: { fontWeight: '700' },
  error: { color: '#b91c1c', margin: 16 },
});
