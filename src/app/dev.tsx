import { Redirect } from 'expo-router';

import { DevSettingsScreen } from '@/screens/DevSettingsScreen';

export default function DevRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <DevSettingsScreen />;
}
