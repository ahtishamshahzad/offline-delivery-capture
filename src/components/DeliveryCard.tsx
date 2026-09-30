import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStoredPhotoUri } from '@/hooks/usePhotoCapture';
import { colors, font, radius, spacing } from '@/theme';
import type { Delivery } from '@/types/delivery';
import { formatRelative } from '@/utils/time';
import { shortId } from '@/utils/uuid';

import { PrimaryButton } from './PrimaryButton';
import { StatusBadge } from './StatusBadge';

interface Props {
  delivery: Delivery;
  online: boolean | null;
  onPress: () => void;
  onRetry: () => void;
}

export function DeliveryCard({ delivery, online, onPress, onRetry }: Props) {
  const photoUri = useStoredPhotoUri(delivery.photoPath);
  const canRetryNow = delivery.status === 'failed';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Delivery from ${delivery.supplierName}, ${delivery.poNumber}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.row}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbMissing]}>
            <Text style={styles.thumbMissingText}>No photo</Text>
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.supplier} numberOfLines={1}>
              {delivery.supplierName}
            </Text>
            <Text style={styles.meta}>#{shortId(delivery.id)}</Text>
          </View>
          <Text style={styles.po}>{delivery.poNumber}</Text>
          <Text style={styles.meta}>{formatRelative(delivery.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <View style={styles.status}>
          <StatusBadge delivery={delivery} online={online} />
        </View>
        {canRetryNow && (
          <PrimaryButton
            title={delivery.nextAttemptAt !== null ? 'Retry now' : 'Retry'}
            onPress={onRetry}
            variant="danger"
            compact
          />
        )}
      </View>
      {delivery.status === 'failed' && delivery.errorMessage ? (
        <Text style={styles.error} numberOfLines={2}>
          {delivery.errorMessage}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: '#E5E7EB' },
  thumbMissing: { alignItems: 'center', justifyContent: 'center' },
  thumbMissingText: { fontSize: 11, color: colors.textMuted },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  supplier: { fontSize: font.lg, fontWeight: '700', color: colors.text, flexShrink: 1 },
  po: { fontSize: font.md, color: colors.text },
  meta: { fontSize: font.sm, color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  status: { flex: 1 },
  error: { fontSize: font.sm, color: colors.danger },
});
