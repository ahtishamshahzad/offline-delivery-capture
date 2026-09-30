import { StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/theme';

export function ConnectivityBanner({ online }: { online: boolean | null }) {
  if (online === null) return null;
  const offline = !online;
  return (
    <View
      style={[styles.banner, { backgroundColor: offline ? colors.offlineBg : colors.onlineBg }]}
      accessibilityRole="summary"
      accessibilityLabel={offline ? 'Offline' : 'Online'}>
      <Text style={[styles.dot, { color: offline ? colors.offline : colors.online }]}>●</Text>
      <Text style={[styles.text, { color: offline ? colors.offline : colors.online }]}>
        {offline ? 'Offline — deliveries are saved and will sync when connection returns' : 'Online'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dot: { fontSize: font.md },
  text: { fontSize: font.sm, fontWeight: '600', flexShrink: 1 },
});
