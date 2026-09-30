import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const PHOTO_DIR = 'photos';
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.6;

export type PhotoResult =
  | { ok: true; tempUri: string }
  | { ok: false; reason: 'denied' | 'cancelled' | 'unavailable'; message?: string };

function fromPickerResult(result: ImagePicker.ImagePickerResult): PhotoResult {
  if (result.canceled || result.assets.length === 0) return { ok: false, reason: 'cancelled' };
  return { ok: true, tempUri: result.assets[0].uri };
}

export async function takePhoto(): Promise<PhotoResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: 'denied' };
  try {
    return fromPickerResult(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
  } catch (error) {
    // e.g. iOS Simulator has no camera.
    return {
      ok: false,
      reason: 'unavailable',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}

/** Picking from the library needs no permission prompt on current OS versions. */
export async function pickPhoto(): Promise<PhotoResult> {
  try {
    return fromPickerResult(
      await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }),
    );
  } catch (error) {
    return {
      ok: false,
      reason: 'unavailable',
      message: error instanceof Error ? error.message : undefined,
    };
  }
}

function photoFile(relativePath: string): File {
  return new File(Paths.document, relativePath);
}

/**
 * Resize + compress the picked image and copy it into the app's document
 * directory, which survives restarts (picker/cache URIs may not).
 * Returns the path relative to the document directory.
 */
export async function persistPhoto(tempUri: string, deliveryId: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(tempUri)
    .resize({ width: MAX_WIDTH, height: null })
    .renderAsync();
  const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });

  new Directory(Paths.document, PHOTO_DIR).create({ idempotent: true });
  const relativePath = `${PHOTO_DIR}/${deliveryId}.jpg`;
  await new File(saved.uri).copy(photoFile(relativePath), { overwrite: true });
  return relativePath;
}

export function resolvePhotoUri(relativePath: string): string {
  return photoFile(relativePath).uri;
}

export function photoExists(relativePath: string): boolean {
  return photoFile(relativePath).exists;
}

export function deletePhoto(relativePath: string): void {
  const file = photoFile(relativePath);
  if (file.exists) file.delete();
}

/** Dev-only: remove every stored ticket photo. */
export function deleteAllPhotos(): void {
  const directory = new Directory(Paths.document, PHOTO_DIR);
  if (directory.exists) directory.delete();
}

/** Base64 of the stored photo, or null if the file is gone. */
export async function readPhotoBase64(relativePath: string): Promise<string | null> {
  const file = photoFile(relativePath);
  if (!file.exists) return null;
  return file.base64();
}
