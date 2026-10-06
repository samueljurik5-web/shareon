import path from 'node:path';
import { env } from '../../config/env.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import type { StorageProvider } from './StorageProvider.js';

export const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

export const storage: StorageProvider = new LocalStorageProvider(uploadDir);

export type { StorageProvider };
