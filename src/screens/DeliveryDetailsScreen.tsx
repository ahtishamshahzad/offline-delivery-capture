import { Stack } from 'expo-router';
import { Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusBadge } from '@/components/StatusBadge';
import { useDelivery } from '@/hooks/useDeliveries';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useStoredPhotoUri } from '@/hooks/usePhotoCapture';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { colors, font, radius, spacing } from '@/theme';
import type { Delivery } from '@/types/delivery';
import { formatDateTime } from '@/utils/time';

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Details({ delivery }: { delivery: Delivery }) {
  const online = useNetworkStatus();
  const { retry } = useSyncQueue();
  const photoUri = useStoredPhotoUri(delivery.photoPath);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
      ) : (
        <View style={[styles.photo, styles.photoMissing]}>
          <Text style={styles.muted}>Photo file is missing on this device</Text>
        </View>
      )}

      <View style={styles.card}>
        <StatusBadge delivery={delivery} online={online} />
        {delivery.status === 'failed' && (
          <>
            <Text style={styles.failedNote}>
              Upload failed. Your delivery is still saved on this device.
            </Text>
            <PrimaryButton title="Retry upload" onPress={() => void retry(delivery.id)} variant="danger" />
          </>
        )}
      </View>

      <View style={styles.card}>
        <Row label="Supplier" value={delivery.supplierName} />
        <Row label="PO number" value={delivery.poNumber} />
        <Row label="Note" value={delivery.note || '—'} />
        <Row label="Captured" value={formatDateTime(delivery.createdAt)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sync details</Text>
        <Row label="Local id" value={delivery.id} mono />
        <Row label="Idempotency key" value={delivery.idempotencyKey} mono />
        <Row label="Remote id" value={delivery.remoteId ?? '—'} mono />
        <Row label="Server replay" value={delivery.status === 'synced' ? (delivery.remoteReplayed ? 'Yes — duplicate prevented' : 'No — first upload') : '—'} />
        <Row label="Failed attempts" value={String(delivery.retryCount)} />
        <Row label="Last attempt" value={formatDateTime(delivery.lastAttemptAt)} />
        <Row label="Next auto retry" value={formatDateTime(delivery.nextAttemptAt)} />
        <Row label="Last error" value={delivery.errorMessage ?? '—'} />
      </View>
    </ScrollView>
  );
}

export function DeliveryDetailsScreen({ id }: { id: string }) {
  const { delivery, loading } = useDelivery(id);
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: delivery ? delivery.supplierName : 'Delivery' }} />
      {delivery ? (
        <Details delivery={delivery} />
      ) : loading ? null : (
        <EmptyState title="Delivery not found" message="It may have been removed from this device." />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: '#111827' },
  photoMissing: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5E7EB' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  failedNote: { fontSize: font.md, color: colors.danger },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  row: { gap: 2 },
  rowLabel: { fontSize: font.sm, color: colors.textMuted },
  rowValue: { fontSize: font.md, color: colors.text },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontSize: font.sm },
  muted: { color: colors.textMuted },
});
