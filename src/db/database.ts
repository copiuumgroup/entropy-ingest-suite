import Dexie, { type Table } from 'dexie';

export interface ProjectMetadata {
  id?: number;
  name: string;
  artist?: string;
  coverArt?: string;
  filePath?: string;
  lastModified: number;
  // Mastering State
  settings: {
    speed: number;
    reverbWet: number;
    eq: {
      sub: number;
      bass: number;
      mid: number;
      treble: number;
      air: number;
    };
    attenuation: number;
    limiter: boolean;
    roomSize: number;
  };
  detectedBpm?: number;
  detectedGenre?: string;
  sourceUrl?: string;
  archivedAt?: number;
  mediaType?: 'audio' | 'video';
}

export class StudioDatabase extends Dexie {
  projects!: Table<ProjectMetadata>;

  constructor() {
    super('StudioDatabase');
    this.version(2).stores({
      projects: '++id, name, lastModified, sourceUrl'
    });
  }
}

export const db = new StudioDatabase();
