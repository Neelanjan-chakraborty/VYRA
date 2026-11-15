import { File } from 'expo-file-system';

/**
 * A local file as a form-data part on a phone. Expo's `fetch` can't send React
 * Native's `{ uri, name, type }` descriptor, so the file is passed as a Blob.
 */
export function nativeFilePart(uri: string): Blob {
  return new File(uri);
}
