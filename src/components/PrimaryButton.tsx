import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

interface Props {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  compact?: boolean;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  compact = false,
}: Props) {
  const inactive = disabled || loading;
  const filled = variant === 'primary';
  const tint = variant === 'danger' ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        filled ? { backgroundColor: tint } : { borderColor: tint, borderWidth: 1.5 },
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.8 },
      ]}>
      {loading ? (
        <ActivityIndicator color={filled ? colors.primaryText : tint} />
      ) : (
        <Text style={[styles.text, { color: filled ? colors.primaryText : tint }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  compact: { minHeight: 44, paddingHorizontal: spacing.md },
  text: { fontSize: font.md, fontWeight: '700' },
});
