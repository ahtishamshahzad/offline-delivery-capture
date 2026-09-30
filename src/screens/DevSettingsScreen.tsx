import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/PrimaryButton';
import { useDevSettings, type ResendResult } from '@/hooks/useDevSettings';
import { colors, font, radius, spacing } from '@/theme';
import { FAILURE_MODES, UPLOAD_DELAYS_MS, type FailureMode } from '@/types/settings';

const FAILURE_LABELS: Record<FailureMode, string> = {
  off: 'Off',
  server_error: 'Server error',
  malformed: 'Malformed',
  timeout: 'Timeout',
};

function Segmented<T extends string | number>({
  options,
  value,
  label,
  onChange,
}: {
  options: readonly T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label(option)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DevSettingsScreen() {
  const { settings, update, resendLastSynced, serverCount, resetDemo, apiUrl } = useDevSettings();
  const [count, setCount] = useState<number | string | null>(null);
  const [resend, setResend] = useState<ResendResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    serverCount().then(setCount);
  }, [serverCount]);

  useEffect(refreshCount, [refreshCount]);

  const onReset = () => {
    Alert.alert(
      'Reset demo data?',
      'Deletes every delivery and photo on this device, turns simulations off, and clears the mock server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResend(null);
            setResetMessage(await resetDemo());
            refreshCount();
          },
        },
      ],
    );
  };

  const onResend = async () => {
    setBusy(true);
    setResend(await resendLastSynced());
    setBusy(false);
    refreshCount();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Developer Settings' }} />

      <View style={styles.card}>
        <Text style={styles.title}>Mock server</Text>
        <Text style={styles.mono}>{apiUrl ?? 'EXPO_PUBLIC_API_URL not set'}</Text>
        <View style={styles.inline}>
          <Text style={styles.body}>Server deliveries: {count ?? '…'}</Text>
          <PrimaryButton title="Refresh" onPress={refreshCount} variant="secondary" compact />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Simulate upload failure</Text>
        <Segmented
          options={FAILURE_MODES}
          value={settings.failureMode}
          label={(mode) => FAILURE_LABELS[mode]}
          onChange={(mode) => update('failureMode', mode)}
        />
        <Text style={styles.hint}>Applies to every upload until switched off.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Upload delay</Text>
        <Segmented
          options={UPLOAD_DELAYS_MS}
          value={settings.uploadDelayMs}
          label={(ms) => `${ms / 1000} s`}
          onChange={(ms) => update('uploadDelayMs', ms)}
        />
        <Text style={styles.hint}>Use 8 s to kill the app while a delivery shows “Uploading…”.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Duplicate protection</Text>
        <Text style={styles.hint}>
          Re-sends the most recent synced delivery with its original Idempotency-Key.
        </Text>
        <PrimaryButton title="Re-send last synced delivery" onPress={() => void onResend()} loading={busy} />
        {resend && (
          <View style={styles.result}>
            {resend.ok ? (
              <>
                <Text style={styles.body}>{resend.supplierName}</Text>
                <Text style={styles.body}>replayed: {String(resend.result.replayed)}</Text>
                <Text style={styles.mono}>server remoteId: {resend.result.remoteId}</Text>
                <Text style={styles.mono}>local remoteId:  {resend.localRemoteId ?? '—'}</Text>
                <Text style={styles.success}>
                  {resend.result.replayed && resend.result.remoteId === resend.localRemoteId
                    ? '✓ Same delivery — no duplicate created'
                    : 'Server created a new record'}
                </Text>
              </>
            ) : (
              <Text style={styles.error}>{resend.message}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Start a demo from scratch</Text>
        <Text style={styles.hint}>
          Clears local deliveries and photos, resets the toggles above and empties the mock server.
        </Text>
        <PrimaryButton title="Reset demo data" onPress={onReset} variant="danger" />
        {resetMessage && <Text style={styles.body}>{resetMessage}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: font.md, fontWeight: '700', color: colors.text },
  body: { fontSize: font.md, color: colors.text },
  hint: { fontSize: font.sm, color: colors.textMuted },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: font.sm,
    color: colors.text,
  },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmented: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  segmentSelected: { backgroundColor: colors.primary },
  segmentText: { fontSize: font.sm, color: colors.text, fontWeight: '600' },
  segmentTextSelected: { color: colors.primaryText },
  result: { gap: 2, paddingTop: spacing.sm },
  success: { fontSize: font.md, color: colors.online, fontWeight: '700' },
  error: { fontSize: font.md, color: colors.danger },
});
