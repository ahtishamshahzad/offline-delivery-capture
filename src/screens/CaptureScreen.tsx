import { router, Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormField } from '@/components/FormField';
import { PhotoPicker } from '@/components/PhotoPicker';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCreateDelivery } from '@/hooks/useCreateDelivery';
import { usePhotoCapture } from '@/hooks/usePhotoCapture';
import { colors, font, spacing } from '@/theme';
import { newId } from '@/utils/uuid';
import {
  hasErrors,
  LIMITS,
  validateDelivery,
  type DeliveryFormErrors,
  type DeliveryFormValues,
} from '@/utils/validation';

const EMPTY_FORM: DeliveryFormValues = { photoUri: null, supplierName: '', poNumber: '', note: '' };

export function CaptureScreen() {
  // One id per form: re-saving the same draft can never create a second row.
  const [draftId] = useState(newId);
  const [values, setValues] = useState<DeliveryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<DeliveryFormErrors>({});
  const { save, saving } = useCreateDelivery();

  const setField = useCallback(<K extends keyof DeliveryFormValues>(key: K, value: DeliveryFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }, []);

  const onPhoto = useCallback((uri: string) => setField('photoUri', uri), [setField]);
  const photo = usePhotoCapture(onPhoto);

  const onSave = async () => {
    const validation = validateDelivery(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    const result = await save(draftId, values);
    if (!result.ok) {
      Alert.alert('Could not save delivery', result.message);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Material Delivery' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Saved on this device first — no signal needed.</Text>
          <PhotoPicker
            uri={values.photoUri}
            error={errors.photoUri}
            onTakePhoto={photo.takePhoto}
            onChoosePhoto={photo.choosePhoto}
          />
          <FormField
            label="Supplier Name"
            required
            value={values.supplierName}
            onChangeText={(text) => setField('supplierName', text)}
            placeholder="e.g. ABC Materials"
            maxLength={LIMITS.supplierName}
            autoCapitalize="words"
            returnKeyType="next"
            error={errors.supplierName}
          />
          <FormField
            label="PO Number"
            required
            value={values.poNumber}
            onChangeText={(text) => setField('poNumber', text)}
            placeholder="e.g. PO-1024"
            maxLength={LIMITS.poNumber}
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.poNumber}
          />
          <FormField
            label="Note"
            value={values.note}
            onChangeText={(text) => setField('note', text)}
            placeholder="e.g. 20 bags of cement"
            maxLength={LIMITS.note}
            multiline
            error={errors.note}
          />
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton title="Save Delivery" onPress={() => void onSave()} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg },
  hint: { fontSize: font.sm, color: colors.textMuted },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
