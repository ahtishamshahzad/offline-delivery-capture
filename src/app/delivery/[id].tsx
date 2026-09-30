import { useLocalSearchParams } from 'expo-router';

import { DeliveryDetailsScreen } from '@/screens/DeliveryDetailsScreen';

export default function DeliveryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DeliveryDetailsScreen id={id} />;
}
