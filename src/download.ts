import { PermissionsAndroid, Platform, type Permission } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';

import type { FetchResult } from './api';

export async function ensureGalleryPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS asks on first save (Info.plist)

  const P = PermissionsAndroid.PERMISSIONS;
  const version = Number(Platform.Version);
  const needed: Permission[] =
    version >= 33
      ? [P.READ_MEDIA_IMAGES, P.READ_MEDIA_VIDEO]
      : version >= 29
      ? [P.READ_EXTERNAL_STORAGE]
      : [P.READ_EXTERNAL_STORAGE, P.WRITE_EXTERNAL_STORAGE];

  const statuses = await PermissionsAndroid.requestMultiple(needed);
  return needed.every(p => statuses[p] === PermissionsAndroid.RESULTS.GRANTED);
}

// Downloads every item to the cache, then copies it into the gallery.
// CDN URLs often have no file extension, so the name is built from the
// media type — the gallery needs the extension to recognize the file.
export async function saveToGallery(
  result: FetchResult,
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const total = result.items.length;
  for (let i = 0; i < total; i++) {
    const item = result.items[i];
    const ext = item.type === 'video' ? 'mp4' : 'jpg';
    const path = `${RNFS.CachesDirectoryPath}/${result.id}_${i + 1}.${ext}`;

    const { statusCode } = await RNFS.downloadFile({
      fromUrl: item.downloadUrl,
      toFile: path,
    }).promise;
    try {
      if (statusCode < 200 || statusCode >= 300) {
        throw new Error(
          `Falha ao baixar o arquivo ${i + 1} (HTTP ${statusCode})`,
        );
      }
      await CameraRoll.saveAsset(`file://${path}`, {
        type: item.type === 'video' ? 'video' : 'photo',
        album: 'InstaDownloader',
      });
    } finally {
      await RNFS.unlink(path).catch(() => {});
    }
    onProgress?.(i + 1, total);
  }
  return total;
}
