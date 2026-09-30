import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

import { PrimaryButton } from './PrimaryButton';

interface Props {
  uri: string | null;
  error?: string;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
}

export function PhotoPicker({ uri, error, onTakePhoto, onChoosePhoto }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        Delivery ticket photo<Text style={styles.required}> *</Text>
      </Text>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.preview}
          resizeMode="cover"
          accessibilityLabel="Delivery ticket photo preview"
        />
      ) : (
        <View style={[styles.preview, styles.placeholder, error ? styles.placeholderError : null]}>
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}
      <View style={styles.buttons}>
        <View style={styles.button}>
          <PrimaryButton title={uri ? 'Retake Photo' : 'Take Photo'} onPress={onTakePhoto} compact />
        </View>
        <View style={styles.button}>
          <PrimaryButton title="Choose Photo" onPress={onChoosePhoto} variant="secondary" compact />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  required: { color: colors.danger },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: '#E5E7EB' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9CA3AF',
  },
  placeholderError: { borderColor: colors.danger },
  placeholderText: { color: colors.textMuted, fontSize: font.md },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
  error: { fontSize: font.sm, color: colors.danger },
});
