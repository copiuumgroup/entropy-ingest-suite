export interface MediaItem {
  id: string;
  name: string;
  artist?: string;
  coverArt?: string;
  filePath?: string;
  mediaType: 'audio' | 'video';
  addedAt: number;
}
