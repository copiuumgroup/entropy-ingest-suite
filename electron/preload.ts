const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMusicPath: () => ipcRenderer.invoke('get-music-path'),
  getMetadata: (filePath: string) => ipcRenderer.invoke('get-metadata', filePath),
  saveFile: (fileName: string, arrayBuffer: ArrayBuffer) => 
    ipcRenderer.invoke('save-file', fileName, arrayBuffer),
  selectDownloadDirectory: () => ipcRenderer.invoke('select-download-directory'),
  ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav'; mode?: 'audio' | 'video'; destinationPath?: string }) => 
    ipcRenderer.invoke('ytdlp-download', url, options),
  ytdlpGetInfo: (url: string) => ipcRenderer.invoke('ytdlp-get-info', url),
  ytdlpCancel: () => ipcRenderer.invoke('ytdlp-cancel'),
  aria2Download: (url: string, destinationPath?: string, options?: any) => ipcRenderer.invoke('aria2-direct-download', url, destinationPath, options),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  revealFile: (filePath: string) => ipcRenderer.invoke('reveal-file', filePath),
  openMusicFolder: () => ipcRenderer.invoke('open-music-folder'),
  openAppDataFolder: () => ipcRenderer.invoke('open-appdata-folder'),
  checkSystemBinary: () => ipcRenderer.invoke('check-system-binary'),
  purgeArchives: () => ipcRenderer.invoke('purge-archives'),
  getEngineMetrics: () => ipcRenderer.invoke('get-engine-metrics'),
  extractAudio: (path: string) => ipcRenderer.invoke('extract-audio', path),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => 
    ipcRenderer.invoke('cache-audio-file', sourcePath, fileName, buffer),
  onYtdlpLog: (callback: (data: string) => void) => {
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on('ytdlp-log', listener);
    return () => ipcRenderer.removeListener('ytdlp-log', listener);
  },
  onIngestProgress: (callback: (data: { url: string; percent?: number; speed?: string }) => void) => {
    const listener = (_event: any, data: { url: string; percent?: number; speed?: string }) => callback(data);
    ipcRenderer.on('ingest-progress', listener);
    return () => ipcRenderer.removeListener('ingest-progress', listener);
  },
  updateTitleBarOverlay: (settings: any) => ipcRenderer.invoke('update-titlebar-overlay', settings),
  getSystemAccent: () => ipcRenderer.invoke('get-system-accent'),
  getTempPath: () => ipcRenderer.invoke('get-temp-path'),
  setZoomFactor: (factor: number) => ipcRenderer.send('set-zoom-factor', factor),
  studioEngine: {
    command: (cmd: any) => ipcRenderer.invoke('engine:command', cmd),
    onLog: (callback: (data: string) => void) => {
      const listener = (_event: any, data: string) => callback(data);
      ipcRenderer.on('engine-log', listener);
      return () => ipcRenderer.removeListener('engine-log', listener);
    }
  }
});
