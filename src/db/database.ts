import Dexie, { type Table } from 'dexie';

export interface MediaMetadata {
  id?: number;
  name: string;
  artist?: string;
  coverArt?: string;
  filePath?: string;
  lastModified: number;
  sourceUrl?: string;
  mediaType?: 'audio' | 'video';
  duration?: number;
}

export interface StagedItem {
  id: string;
  url: string;
  info: any;
  addedAt: number;
}

export interface QueueItem {
  id: string;
  url: string;
  title?: string;
  uploader?: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
  addedAt: number;
}

export class EntropyDatabase extends Dexie {
  projects!: Table<MediaMetadata>;
  stagedItems!: Table<StagedItem>;
  downloadQueue!: Table<QueueItem>;

  constructor() {
    super('EntropyDatabase');
    this.version(1).stores({
      projects: '++id, name, lastModified, sourceUrl',
      stagedItems: 'id, url, addedAt',
      downloadQueue: 'id, url, status, addedAt'
    });
  }
}

export const db = new EntropyDatabase();
