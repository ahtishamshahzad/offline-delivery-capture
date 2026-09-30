import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectivityBanner } from '@/components/ConnectivityBanner';
import { DeliveryCard } from '@/components/DeliveryCard';
import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { summarize, useSyncQueue } from '@/hooks/useSyncQueue';
import { colors, font, spacing } from '@/theme';

function DevSettingsButton() {
  return (
    <Pressable
      onPress={() => router.push('/dev')}
      accessibilityRole="button"
      accessibilityLabel="Developer settings"
      hitSlop={12}>
      <Text style={styles.gear}>⚙︎</Text>
    </Pressable>
  );
}

export function QueueScreen() {
  const { deliveries, loading } = useDeliveries();
  const online = useNetworkStatus();
  const { syncNow, retry } = useSyncQueue();
  const summary = summarize(deliveries);

  // Sync trigger: opening the queue uploads anything still queued (if online).
  useFocusEffect(
    useCallback(() => {
      syncNow('queue-focus');
    }, [syncNow]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen
        options={{ title: 'Delivery Queue', headerRight: __DEV__ ? DevSettingsButton : undefined }}
      />
      <ConnectivityBanner online={online} />
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          deliveries.length > 0 ? (
            <Text style={styles.summary}>
              {summary.pending} pending · {summary.failed} failed · {summary.synced} synced
            </Text>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title="No deliveries yet"
              message="Capture a delivery ticket. It is saved on this device first, so it works without signal."
            />
          )
        }
        renderItem={({ item }) => (
          <DeliveryCard
            delivery={item}
            online={online}
            onPress={() => router.push({ pathname: '/delivery/[id]', params: { id: item.id } })}
            onRetry={() => void retry(item.id)}
          />
        )}
      />
      <View style={styles.footer}>
        <PrimaryButton title="+ New Delivery" onPress={() => router.push('/capture')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  summary: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.xs },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gear: { fontSize: 22, color: colors.text },
});
