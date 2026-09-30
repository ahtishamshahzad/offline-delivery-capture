import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { colors, font, spacing } from '@/theme';

export default function RootLayout() {
  const boot = useAppBootstrap();

  if (boot.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (boot.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Could not open local storage</Text>
        <Text style={styles.errorBody}>{boot.message}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  errorTitle: { fontSize: font.lg, fontWeight: '700', color: colors.danger },
  errorBody: { fontSize: font.md, color: colors.text, textAlign: 'center' },
});
