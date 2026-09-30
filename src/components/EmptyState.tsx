import { StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/theme';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  message: { fontSize: font.md, color: colors.textMuted, textAlign: 'center' },
});
