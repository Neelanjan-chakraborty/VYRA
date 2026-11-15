import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** The server stores photos at up to 1600 px; anything bigger is wasted upload. */
const MAX_UPLOAD_EDGE = 1600;
const UPLOAD_QUALITY = 0.82;

export interface PreparedImage {
  readonly uri: string;
  readonly mimeType: string;
  /** Present on web, where uploads need a real file. */
  readonly file?: File;
}

/**
 * Shrinks a picked photo to the size the server keeps before uploading it,
 * so a 12-megapixel camera photo doesn't cross a mobile network in full. The
 * server still checks and re-encodes everything; if resizing fails, the
 * original is sent.
 */
export async function prepareImageForUpload(asset: {
  uri: string;
  width?: number;
  height?: number;
  mimeType?: string;
  file?: File;
}): Promise<PreparedImage> {
  const original: PreparedImage = {
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
    ...(asset.file ? { file: asset.file } : {}),
  };
  try {
    const width = asset.width ?? 0;
    const height = asset.height ?? 0;
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(width, height) > MAX_UPLOAD_EDGE) {
      context.resize(width >= height ? { width: MAX_UPLOAD_EDGE } : { height: MAX_UPLOAD_EDGE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: UPLOAD_QUALITY, format: SaveFormat.JPEG });
    if (Platform.OS === 'web') {
      const blob = await (await fetch(saved.uri)).blob();
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      // Keep whichever is smaller (a tiny PNG can beat a re-encoded JPEG).
      return asset.file && asset.file.size <= file.size
        ? original
        : { uri: saved.uri, mimeType: 'image/jpeg', file };
    }
    return { uri: saved.uri, mimeType: 'image/jpeg' };
  } catch {
    return original;
  }
}
