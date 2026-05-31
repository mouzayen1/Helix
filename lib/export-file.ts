// Persist + share an export file — NATIVE variant (iOS/Android).
// Writes to the app document directory, then opens the OS share sheet so
// the user can save it to Files / send it. Web uses export-file.web.ts
// (a browser download) instead, which keeps expo-file-system/expo-sharing
// out of the web bundle.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

/**
 * Save `content` as `filename` and offer it to the user. Returns the
 * filename for status display. `mime` is unused on native (the share
 * sheet infers from the extension) but kept for a uniform signature.
 */
export async function saveExport(
  filename: string,
  content: string,
  _mime: string
): Promise<string> {
  const dir = FileSystem.documentDirectory ?? '';
  const path = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(path, content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
  return filename;
}
