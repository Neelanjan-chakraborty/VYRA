import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ObjectStorage } from './storage.js';

/** Development storage on local disk. Refused in production by configuration validation. */
export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(directory);
  }

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error('Storage key escapes the root');
    return target;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
