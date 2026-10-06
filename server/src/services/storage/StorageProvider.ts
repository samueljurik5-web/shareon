export interface StoredFile {
  /** Public URL path that clients can reference, e.g. /uploads/<hash>.jpg */
  url: string;
}

/**
 * Storage abstraction. Development uses LocalStorageProvider.
 * Extension point: implement S3StorageProvider / CloudinaryStorageProvider with the same
 * interface and select it via STORAGE_PROVIDER.
 */
export interface StorageProvider {
  save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredFile>;
  exists(url: string): Promise<boolean>;
}
