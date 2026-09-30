import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';

import {
  photoExists,
  pickPhoto,
  resolvePhotoUri,
  takePhoto,
  type PhotoResult,
} from '@/services/photoService';

function explain(result: Exclude<PhotoResult, { ok: true }>): void {
  if (result.reason === 'denied') {
    Alert.alert(
      'Camera access needed',
      'Allow camera access in Settings to photograph delivery tickets. You can still choose a photo from your library.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ],
    );
  } else if (result.reason === 'unavailable') {
    Alert.alert(
      'Camera unavailable',
      'This device cannot take a photo right now. Use "Choose Photo" instead.',
    );
  }
}

/** Photo capture for the form, plus helpers to show stored photos. */
export function usePhotoCapture(onPicked: (uri: string) => void) {
  const run = useCallback(
    async (source: () => Promise<PhotoResult>) => {
      const result = await source();
      if (result.ok) onPicked(result.tempUri);
      else explain(result);
    },
    [onPicked],
  );

  return {
    takePhoto: () => void run(takePhoto),
    choosePhoto: () => void run(pickPhoto),
  };
}

/** URI of a stored photo, or null if the file no longer exists. */
export function useStoredPhotoUri(relativePath: string): string | null {
  return photoExists(relativePath) ? resolvePhotoUri(relativePath) : null;
}
