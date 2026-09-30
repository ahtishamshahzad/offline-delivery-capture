import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  required?: boolean;
}

export function FormField({ label, error, required = false, multiline, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  required: { color: colors.danger },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.md,
    color: colors.text,
    minHeight: 48,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
  error: { fontSize: font.sm, color: colors.danger },
});
