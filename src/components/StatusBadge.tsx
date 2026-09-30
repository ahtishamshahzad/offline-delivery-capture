import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useNow } from '@/hooks/useNow';
import { font, radius, spacing, statusColors } from '@/theme';
import type { Delivery } from '@/types/delivery';
import { secondsUntil } from '@/utils/time';

const LABELS = {
  queued: 'Queued',
  uploading: 'Uploading…',
  synced: 'Synced ✓',
  failed: 'Failed',
} as const;

function detailText(delivery: Delivery, online: boolean | null, now: number): string {
  switch (delivery.status) {
    case 'queued':
      return online === false ? 'Waiting for connection' : 'Waiting to upload';
    case 'uploading':
      return 'Sending to server';
    case 'synced':
      return delivery.remoteReplayed ? 'Server already had it (no duplicate)' : 'Saved on server';
    case 'failed':
      if (delivery.nextAttemptAt !== null) {
        if (online === false) return 'Will retry when back online';
        const seconds = secondsUntil(delivery.nextAttemptAt, now);
        return seconds > 0 ? `Retrying in ${seconds}s` : 'Retrying…';
      }
      return 'Upload failed — still saved on this device';
  }
}

interface Props {
  delivery: Delivery;
  online: boolean | null;
}

export function StatusBadge({ delivery, online }: Props) {
  const ticking = delivery.status === 'failed' && delivery.nextAttemptAt !== null;
  const now = useNow(1000, ticking);
  const palette = statusColors[delivery.status];
  const detail = detailText(delivery, online, now);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Status: ${LABELS[delivery.status]}. ${detail}`}>
      <View style={[styles.pill, { backgroundColor: palette.bg }]}>
        {delivery.status === 'uploading' && (
          <ActivityIndicator size="small" color={palette.fg} style={styles.spinner} />
        )}
        <Text style={[styles.label, { color: palette.fg }]}>{LABELS[delivery.status]}</Text>
      </View>
      <Text style={styles.detail} numberOfLines={2}>
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  spinner: { marginRight: spacing.xs, transform: [{ scale: 0.7 }] },
  label: { fontSize: font.sm, fontWeight: '700' },
  detail: { fontSize: font.sm, color: '#4B5563', flexShrink: 1 },
});
