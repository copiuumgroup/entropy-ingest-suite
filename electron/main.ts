import { app, BrowserWindow, protocol, net, ipcMain, session, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import { spawn } from 'child_process';
import os from 'os';

const activeProcesses = new Map<string, any>();
const MAX_BUFFER_SIZE = 512 * 1024 * 1024; // 512MB Limit

function isPathSafe(filePath: string) {
  try {
    const musicPath = path.resolve(app.getPath('music'));
    const userDataPath = path.resolve(app.getPath('userData'));
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(musicPath) || resolvedPath.startsWith(userDataPath);
  } catch (e) { return false; }
}

function cleanupPartialFiles() {
  const musicPath = app.getPath('music');
  try {
    if (!fs.existsSync(musicPath)) return;
    const files = fs.readdirSync(musicPath);
    files.forEach(file => {
      if (file.endsWith('.part') || file.endsWith('.ytdl')) {
        try { fs.unlinkSync(path.join(musicPath, file)); } catch (e) {}
      }
    });
  } catch (e) {
    console.error('[SYSTEM] Partial Cleanup Error:', e);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));


protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 32
    },
    transparent: true,
    backgroundColor: '#00000000',
  });

  const osRelease = os.release().split('.');
  if (parseInt(osRelease[0]) >= 10 && parseInt(osRelease[2]) >= 22000) {
    win.setBackgroundMaterial('mica');
  } else {
    win.setBackgroundMaterial('acrylic');
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadURL('studio://app/index.html');
  }

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' studio:; " +
          "script-src 'self' " + (process.env.VITE_DEV_SERVER_URL ? "'unsafe-eval' " : "") + "'unsafe-inline' studio: blob:; " +
          "style-src 'self' 'unsafe-inline' studio:; " +
          "font-src 'self' studio:; " +
          "img-src 'self' studio: data: blob:; " +
          "media-src 'self' studio: media: blob: data:; " +
          "connect-src 'self' studio:;"
        ]
      }
    });
  });

  protocol.handle('studio', async (request) => {
    const url = request.url.replace('studio://app/', '');
    const filePath = path.join(__dirname, '../dist', url);
    try {
      const response = await net.fetch(`file://${filePath}`);
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  protocol.handle('media', async (request) => {
    const rawPath = request.url.replace('media://', '');
    const decodedPath = decodeURIComponent(rawPath);
    const filePath = fileURLToPath('file:///' + decodedPath);
    
    if (!isPathSafe(filePath)) {
      console.warn('[SECURITY] Blocked non-safe media access:', filePath);
      return new Response('Forbidden', { status: 403 });
    }

    try {
      return await net.fetch(`file://${filePath}`);
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();
});

// NATIVE HANDLERS
ipcMain.handle('get-music-path', () => app.getPath('music'));

ipcMain.handle('extract-audio', async (_event, filePath) => {
  if (!isPathSafe(filePath)) return null;

  return new Promise((resolve) => {
    // Positional -- prevents additional arguments from being injected
    const args = [
      '-i', filePath,
      '-f', 'wav',
      '-ar', '44100',
      '-ac', '2',
      '-vn',
      'pipe:1'
    ];
    const ff = spawn('ffmpeg', args);
    const jobId = `ffmpeg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    activeProcesses.set(jobId, ff);

    let chunks: Buffer[] = [];
    let totalSize = 0;
    
    ff.stdout.on('data', (data) => {
      totalSize += data.length;
      if (totalSize > MAX_BUFFER_SIZE) {
        console.error('[SECURITY] Memory Limit Exceeded (512MB). Killing extraction.');
        ff.kill();
        resolve(null);
        return;
      }
      chunks.push(data);
    });

    ff.on('close', (code) => {
      activeProcesses.delete(jobId);
      if (code === 0 && totalSize <= MAX_BUFFER_SIZE) {
        const fullBuffer = Buffer.concat(chunks);
        resolve(fullBuffer.buffer.slice(fullBuffer.byteOffset, fullBuffer.byteOffset + fullBuffer.byteLength));
      } else {
        resolve(null);
      }
    });

    ff.on('error', () => {
      activeProcesses.delete(jobId);
      resolve(null);
    });
  });
});

ipcMain.handle('get-metadata', async (_event, filePath) => {
  if (!isPathSafe(filePath)) return null;
  try {
    const metadata = await mm.parseFile(filePath);
    const picture = metadata.common.picture?.[0];
    let coverArtDataUrl = '';
    if (picture) {
      coverArtDataUrl = `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
    }
    return { title: metadata.common.title, artist: metadata.common.artist, coverArt: coverArtDataUrl };
  } catch (e) { return null; }
});


ipcMain.handle('ytdlp-download', async (event, trackUrl, options) => {
  const mode = options?.mode || 'audio';
  const quality = options?.quality || 'mp3';
  const musicPath = options?.destinationPath || app.getPath('music');
  const win = BrowserWindow.fromWebContents(event.sender);

  return new Promise((resolve) => {
    let args: string[] = [];
    
    if (mode === 'audio') {
      args = [
        '-x', '--audio-format', quality,
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.%(ext)s'),
        '--embed-thumbnail',
        '--add-metadata',
        '--', // End of options
        trackUrl
      ];
      if (quality === 'mp3') {
        args.splice(3, 0, '--audio-quality', '320K');
      }
    } else {
      // VIDEO MODE: Download best MP4 compatible with Chromium
      args = [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.mp4'),
        '--embed-thumbnail',
        '--add-metadata',
        '--', // End of options
        trackUrl
      ];
    }
    
    const process = spawn('yt-dlp', args);
    const jobId = `ytdlp-${trackUrl}-${Date.now()}`; // Unique enough per session
    activeProcesses.set(jobId, process);
    
    let errorLog = '';

    process.on('error', (err) => {
      activeProcesses.delete(jobId);
      const errMsg = `FATAL: Failed to launch yt-dlp. Is it installed and in PATH? (${err.message})`;
      win?.webContents.send('ytdlp-log', errMsg);
      resolve({ success: false, error: 'YT-DLP launch failed' });
    });

    const watchdog = setTimeout(() => {
      if (activeProcesses.has(jobId)) {
        process.kill();
        activeProcesses.delete(jobId);
        win?.webContents.send('ytdlp-log', 'ERROR: Process timed out after 5 minutes.');
      }
    }, 5 * 60 * 1000);

    process.stdout.on('data', (data) => {
      win?.webContents.send('ytdlp-log', data.toString());
    });

    process.stderr.on('data', (data) => {
      const msg = data.toString();
      errorLog += msg;
      win?.webContents.send('ytdlp-log', msg);
    });

    process.on('close', (code) => {
      clearTimeout(watchdog);
      activeProcesses.delete(jobId);

      if (code !== 0 && errorLog) {
        try {
          const logDir = app.getPath('userData');
          const logPath = path.join(logDir, 'ytdlp_error_reports.log');
          fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Failed: ${trackUrl}\n${errorLog}\n${'-'.repeat(40)}\n`);
          console.log(`[SYSTEM] Error report persisted to: ${logPath}`);
        } catch (e) { console.error('[SYSTEM] Failed to write error log:', e); }
      }

      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: 'yt-dlp failed (see log)' });
    });
  });
});

ipcMain.handle('open-music-folder', async () => {
  const musicPath = app.getPath('music');
  shell.openPath(musicPath);
  return true;
});

ipcMain.handle('select-download-directory', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Studio Download Destination',
    buttonLabel: 'Select Folder'
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('check-system-binary', async () => {
  const check = (cmd: string, arg = '--version') => new Promise<boolean>((resolve) => {
    try {
      const proc = spawn(cmd, [arg]);
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    } catch (e) { resolve(false); }
  });

  const ytdlp = await check('yt-dlp');
  const ffmpeg = await check('ffmpeg', '-version');
  const dotnet = await check('dotnet', '--list-runtimes');
  return { ytdlp, ffmpeg, dotnet };
});

ipcMain.handle('get-engine-metrics', () => ({
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  v8: process.versions.v8
}));

ipcMain.handle('purge-archives', async () => {
  try {
    const archivesPath = path.join(app.getPath('userData'), 'archives');
    if (fs.existsSync(archivesPath)) {
      fs.rmSync(archivesPath, { recursive: true, force: true });
      fs.mkdirSync(archivesPath);
    }
    return true;
  } catch (e) {
    console.error('[SYSTEM] Purge Failed:', e);
    return false;
  }
});

ipcMain.handle('ytdlp-cancel', () => {
  console.log(`[SYSTEM] Killing ${activeProcesses.size} active yt-dlp processes...`);
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  cleanupPartialFiles();
  return true;
});

ipcMain.handle('read-file', async (_event, filePath) => {
  if (!isPathSafe(filePath)) return null;
  try {
    console.log(`[IPC] Reading Vaulted File: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`[IPC] File Not Found: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath);
  } catch (e: any) {
    console.error(`[IPC] Read Error: ${e.message}`);
    return null;
  }
});

ipcMain.handle('cache-audio-file', async (_event, sourcePath, fileName, buffer?) => {
  try {
    const archivesPath = path.join(app.getPath('userData'), 'archives');
    if (!fs.existsSync(archivesPath)) fs.mkdirSync(archivesPath, { recursive: true });
    
    // Check source size for unique naming if from disk
    let fileSize = 0;
    if (sourcePath && fs.existsSync(sourcePath)) {
      fileSize = fs.statSync(sourcePath).size;
    } else if (buffer) {
      fileSize = buffer.byteLength;
    }

    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '');
    const vaultName = `${fileSize}-${safeName}`;
    const targetPath = path.join(archivesPath, vaultName);

    // Idempotency check: if file already vaulted, don't copy again
    if (fs.existsSync(targetPath)) return targetPath;

    if (buffer) {
      fs.writeFileSync(targetPath, Buffer.from(buffer));
    } else if (sourcePath) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      return null;
    }
    
    return targetPath;
  } catch (e) {
    console.error('Cache Audio Error:', e);
    return null;
  }
});

ipcMain.handle('save-file', async (event, fileName, arrayBuffer) => {
  console.log(`[IPC] save-file requested for: ${fileName}`);
  const sender = event.sender;
  const win = BrowserWindow.fromWebContents(sender);

  const { filePath, canceled } = await dialog.showSaveDialog(win as BrowserWindow, {
    title: 'Export Mastered Audio',
    defaultPath: path.join(app.getPath('music'), fileName),
    filters: [
      { name: 'Audio Files', extensions: fileName.toLowerCase().endsWith('.mp3') ? ['mp3'] : ['wav'] }
    ],
    buttonLabel: 'Export Master',
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (canceled || !filePath) {
    console.log('[IPC] Save dialog canceled');
    return null;
  }

  try {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    console.log(`[IPC] Successfully saved master to: ${filePath}`);
    return filePath;
  } catch (e) {
    console.error(`[IPC] Failed to save file at ${filePath}:`, e);
    return null;
  }
});

app.on('window-all-closed', () => { app.quit(); });

app.on('will-quit', () => {
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  cleanupPartialFiles();
});
