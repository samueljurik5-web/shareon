import { randomBytes } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageProvider, StoredFile } from './StorageProvider.js';

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly dir: string) {}

  async save(buffer: Buffer, extension: 'jpg' | 'png' | 'webp'): Promise<StoredFile> {
    await mkdir(this.dir, { recursive: true });
    // Never use the client-supplied filename: random name + validated extension only.
    const name = `${randomBytes(16).toString('hex')}.${extension}`;
    await writeFile(path.join(this.dir, name), buffer, { flag: 'wx' });
    return { url: `/uploads/${name}` };
  }

  async exists(url: string): Promise<boolean> {
    const match = /^\/uploads\/([a-f0-9]{32}\.(?:jpg|png|webp))$/.exec(url);
    if (!match) return false;
    try {
      const s = await stat(path.join(this.dir, match[1]));
      return s.isFile();
    } catch {
      return false;
    }
  }
}
