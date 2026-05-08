import { app, BrowserWindow, protocol, net, ipcMain, session, dialog, shell, systemPreferences, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import { spawn } from 'child_process';
import os from 'os';

const activeProcesses = new Map<string, any>();
const MAX_BUFFER_SIZE = 512 * 1024 * 1024; // 512MB Limit
let mainWindow: BrowserWindow | null = null;



function getVaultPath() {
  const localPath = app.getPath('userData').replace('Roaming', 'Local');
  const vaultPath = path.join(localPath, 'vault');
  if (!fs.existsSync(vaultPath)) fs.mkdirSync(vaultPath, { recursive: true });
  return vaultPath;
}

function isPathSafe(filePath: string) {
  try {
    const musicPath = path.resolve(app.getPath('music'));
    const userDataPath = path.resolve(app.getPath('userData'));
    const localDataPath = path.resolve(getVaultPath());
    const tempPath = path.resolve(os.tmpdir());
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(musicPath)
      || resolvedPath.startsWith(userDataPath)
      || resolvedPath.startsWith(localDataPath)
      || resolvedPath.startsWith(tempPath);
  } catch (e) { return false; }
}

function cleanupPartialFiles() {
  const musicPath = app.getPath('music');
  try {
    if (!fs.existsSync(musicPath)) return;
    const files = fs.readdirSync(musicPath);
    files.forEach((file: string) => {
      if (file.endsWith('.part') || file.endsWith('.ytdl')) {
        try { fs.unlinkSync(path.join(musicPath, file)); } catch (e) { }
      }
    });
  } catch (e) {
    console.error('[SYSTEM] Partial Cleanup Error:', e);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));


protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: false, stream: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: false, stream: true } }
]);

// Support Wayland and hardware acceleration on Linux
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  app.commandLine.appendSwitch('disable-features', 'WaylandWpColorManagerV1');
}

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
      height: 38,
      color: '#00000000',
      symbolColor: '#ffffff'
    },
    transparent: false,
    backgroundColor: '#000000',
  });

  mainWindow = win;

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
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' studio:; " +
          "script-src 'self' " + (process.env.VITE_DEV_SERVER_URL ? "'unsafe-eval' " : "") + "'unsafe-inline' studio: blob:; " +
          "style-src 'self' 'unsafe-inline' studio:; " +
          "font-src 'self' studio:; " +
          "img-src 'self' studio: data: blob: https:; " +
          "media-src 'self' studio: media: blob: data: https:; " +
          "connect-src 'self' studio: https:; " +
          "frame-src https://w.soundcloud.com https://www.youtube.com;"
        ]
      }
    });
  });

  protocol.handle('studio', async (request: Request) => {
    const url = request.url.replace('studio://app/', '');
    const filePath = path.join(__dirname, '../dist', url);
    try {
      const response = await net.fetch(`file://${filePath}`);
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  protocol.handle('media', async (request: Request) => {
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
ipcMain.handle('get-system-accent', () => {
  try {
    return systemPreferences.getAccentColor();
  } catch (e) {
    return 'ffffff';
  }
});

ipcMain.handle('get-music-path', () => app.getPath('music'));

ipcMain.handle('update-titlebar-overlay', (_event: IpcMainInvokeEvent, settings: any) => {
  if (mainWindow) {
    mainWindow.setTitleBarOverlay(settings);
    return true;
  }
  return false;
});

ipcMain.handle('get-engine-metrics', async () => {
  const memory = await process.getProcessMemoryInfo();
  const cpu = process.getCPUUsage();

  return {
    memoryWorkingSetMB: Math.round(memory.residentSet / 1024),
    memoryPrivateMB: Math.round(memory.private / 1024),
    cpuPercent: Math.round(cpu.percentCPUUsage)
  };
});

ipcMain.handle('extract-audio', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return null;

  return new Promise((resolve) => {
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

    ff.stdout.on('data', (data: Buffer) => {
      totalSize += data.length;
      if (totalSize > MAX_BUFFER_SIZE) {
        console.error('[SECURITY] Memory Limit Exceeded (512MB). Killing extraction.');
        ff.kill();
        resolve(null);
        return;
      }
      chunks.push(data);
    });

    ff.on('close', (code: number) => {
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

ipcMain.handle('get-metadata', async (_event: IpcMainInvokeEvent, filePath: string) => {
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


ipcMain.handle('ytdlp-get-info', async (_event: IpcMainInvokeEvent, trackUrl: string, options?: any) => {
  return new Promise((resolve) => {
    const proxy = options?.proxy;
    // --flat-playlist gives us metadata without downloading
    const args = ['--dump-json', '--no-warnings', '--remote-components', 'ejs:github'];

    args.push('--', trackUrl);

    const ytdlpProcess = spawn('yt-dlp', args, {
      env: {
        ...process.env,
        ...(proxy ? { ALL_PROXY: proxy, http_proxy: proxy, https_proxy: proxy } : {})
      }
    });
    let output = '';

    ytdlpProcess.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    ytdlpProcess.stderr.on('data', (data: Buffer) => {
      // Log stderr but don't fail unless exit code is non-zero
      console.warn('[YTDLP-META-ERR]', data.toString());
    });

    ytdlpProcess.on('close', (code: number) => {
      if (code === 0) {
        try {
          // Robust parsing: Only look for lines that appear to be JSON objects
          const lines = output.trim().split('\n').filter(l => l.trim().startsWith('{'));
          const results = lines.map(line => {
            try {
              const info = JSON.parse(line);
              let thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : null);

              // Upgrade SoundCloud thumbnail quality if detected
              if (thumbnail && thumbnail.includes('sndcdn.com') && thumbnail.includes('-large')) {
                thumbnail = thumbnail.replace('-large', '-t500x500');
              }

              return {
                title: info.title || info.display_id || 'Untitled',
                uploader: info.uploader || info.channel || info.uploader_id || 'Unknown',
                duration: info.duration || 0,
                thumbnail: thumbnail,
                webpage_url: info.webpage_url || trackUrl
              };
            } catch (e) { return null; }
          }).filter(Boolean);

          if (results.length > 0) {
            resolve({ success: true, infos: results });
          } else {
            resolve({ success: false, error: 'No valid metadata found in output' });
          }
        } catch (e) { resolve({ success: false, error: 'Corrupt metadata stream' }); }
      } else { resolve({ success: false, error: 'yt-dlp failed to fetch metadata' }); }
    });
    ytdlpProcess.on('error', (err: any) => resolve({ success: false, error: err.message }));
  });
});

ipcMain.handle('ytdlp-download', async (event: IpcMainInvokeEvent, trackUrl: string, options: any) => {
  const mode = options?.mode || 'audio';
  const quality = options?.quality || 'mp3';
  const win = BrowserWindow.fromWebContents(event.sender);

  // Modular Ingest Settings
  const connections = options?.connections || 16;
  const splits = options?.splits || 16;
  const userAgent = options?.userAgent || 'Mozilla/5.0';

  let musicPath = options?.destinationPath || app.getPath('music');
  if (options?.destinationPath && !isPathSafe(options.destinationPath)) {
    musicPath = app.getPath('music');
  }

  return new Promise((resolve) => {
    const proxy = options?.proxy;
    let args: string[] = [];

    const aria2Args = `aria2c:-x ${connections} -s ${splits} -j ${connections} -c --user-agent="${userAgent}"`;

    if (mode === 'audio') {
      args = [
        '--downloader', 'aria2c',
        '--downloader-args', aria2Args,
        '-x', '--audio-format', quality,
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.%(ext)s'),
        '--embed-thumbnail',
        '--add-metadata',
        '--continue',
        '--user-agent', userAgent,
        '--remote-components', 'ejs:github',
        '--',
        trackUrl
      ];
      if (quality === 'mp3') {
        args.splice(5, 0, '--audio-quality', '320K');
      }
    } else {
      args = [
        '--downloader', 'aria2c',
        '--downloader-args', aria2Args,
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.mp4'),
        '--embed-thumbnail',
        '--add-metadata',
        '--continue',
        '--user-agent', userAgent,
        '--remote-components', 'ejs:github',
        '--',
        trackUrl
      ];
    }

    const ytdlpProcess = spawn('yt-dlp', args, {
      env: {
        ...process.env,
        ...(proxy ? { ALL_PROXY: proxy, http_proxy: proxy, https_proxy: proxy } : {})
      }
    });
    const jobId = `ytdlp-${trackUrl}-${Date.now()}`;
    activeProcesses.set(jobId, ytdlpProcess);

    let errorLog = '';
    let finalPath = '';

    ytdlpProcess.on('error', (_err: any) => {
      activeProcesses.delete(jobId);
      resolve({ success: false, error: 'YT-DLP launch failed' });
    });

    ytdlpProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      win?.webContents.send('ytdlp-log', { url: trackUrl, data: output });

      const progressMatch = output.match(/\[download\]\s+(\d+\.\d+)%/);
      const speedMatch = output.match(/at\s+([\d\.]+[KMG]iB\/s)/);

      if (progressMatch || speedMatch) {
        win?.webContents.send('ingest-progress', {
          url: trackUrl,
          percent: progressMatch ? parseFloat(progressMatch[1]) : undefined,
          speed: speedMatch ? speedMatch[1] : undefined
        });
      }

      const destMatch = output.match(/Destination:\s+(.*)/);
      if (destMatch) {
          finalPath = destMatch[1].trim();
      }
    });

    ytdlpProcess.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      errorLog += msg;
      win?.webContents.send('ytdlp-log', { url: trackUrl, data: msg });
    });

    ytdlpProcess.on('close', (code: number) => {
      activeProcesses.delete(jobId);
      if (code === 0) resolve({ success: true, filePath: finalPath });
      else resolve({ success: false, error: 'yt-dlp failed (see log)' });
    });
  });
});

ipcMain.handle('aria2-direct-download', async (event: IpcMainInvokeEvent, url: string, destinationPath?: string, options?: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const targetPath = destinationPath || app.getPath('music');

  const connections = options?.connections || 16;
  const splits = options?.splits || 16;
  const userAgent = options?.userAgent || 'Mozilla/5.0';

  return new Promise((resolve) => {
    const args = [
      '-x', connections.toString(),
      '-s', splits.toString(),
      '-j', connections.toString(),
      '-c',
      '--user-agent', userAgent,
      '--dir', targetPath,
      url
    ];

    const aria2Process = spawn('aria2c', args);
    const jobId = `aria2-direct-${Date.now()}`;
    activeProcesses.set(jobId, aria2Process);

    aria2Process.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      win?.webContents.send('ytdlp-log', { url, data: output });

      const progressMatch = output.match(/\((\d+)%\)/);
      const speedMatch = output.match(/DL:([\d\.]+[KMG]iB)/);

      if (progressMatch || speedMatch) {
        win?.webContents.send('ingest-progress', {
          url,
          percent: progressMatch ? parseInt(progressMatch[1]) : undefined,
          speed: speedMatch ? speedMatch[1].replace('DL:', '') + '/s' : undefined
        });
      }
    });

    aria2Process.on('close', (code: number) => {
      activeProcesses.delete(jobId);
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: `aria2c exited with code ${code}` });
    });

    aria2Process.on('error', (_err: any) => {
      activeProcesses.delete(jobId);
      resolve({ success: false, error: _err.message });
    });
  });
});

ipcMain.handle('open-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return false;
  shell.openPath(filePath);
  return true;
});

ipcMain.handle('reveal-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return false;
  shell.showItemInFolder(filePath);
  return true;
});

ipcMain.handle('open-music-folder', async () => {
  const musicPath = app.getPath('music');
  shell.openPath(musicPath);
  return true;
});

ipcMain.handle('select-download-directory', async (event: IpcMainInvokeEvent) => {
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
      proc.on('close', (code: number | null) => resolve(code === 0));
    } catch (e) { resolve(false); }
  });

  const ytdlp = await check('yt-dlp', '--version');
  const ffmpeg = await check('ffmpeg', '-version');
  const aria2 = await check('aria2c', '--version');
  return { ytdlp, ffmpeg, aria2 };
});

ipcMain.handle('purge-archives', async () => {
  try {
    const vaultPath = getVaultPath();
    if (fs.existsSync(vaultPath)) {
      fs.rmSync(vaultPath, { recursive: true, force: true });
      fs.mkdirSync(vaultPath);
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

ipcMain.handle('open-appdata-folder', async () => {
  const userDataPath = app.getPath('userData');
  shell.openPath(userDataPath);
  return true;
});

ipcMain.handle('read-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  } catch (e: any) {
    return null;
  }
});

ipcMain.handle('cache-audio-file', async (_event: IpcMainInvokeEvent, sourcePath: string | null, fileName: string, buffer?: any) => {
  try {
    const vaultPath = getVaultPath();

    let fileSize = 0;
    if (sourcePath && fs.existsSync(sourcePath)) {
      if (!isPathSafe(sourcePath)) {
        console.warn('[SECURITY] Blocked non-safe source path in cache-audio-file:', sourcePath);
        return null;
      }
      fileSize = fs.statSync(sourcePath).size;
    } else if (buffer) {
      fileSize = buffer.byteLength;
    }

    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '');
    const vaultName = `${fileSize}-${safeName}`;
    const targetPath = path.join(vaultPath, vaultName);

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
    return null;
  }
});

ipcMain.handle('save-file', async (event: IpcMainInvokeEvent, fileName: string, arrayBuffer: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  const { filePath, canceled } = await dialog.showSaveDialog(win as BrowserWindow, {
    title: 'Export Mastered Audio',
    defaultPath: path.join(app.getPath('music'), fileName),
    filters: [
      { name: 'Audio Files', extensions: fileName.toLowerCase().endsWith('.mp3') ? ['mp3'] : ['wav'] }
    ],
    buttonLabel: 'Export Master',
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (canceled || !filePath) return null;

  try {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return filePath;
  } catch (e) {
    return null;
  }
});



ipcMain.on('set-zoom-factor', (event, factor) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.webContents.setZoomFactor(factor);
  }
});

ipcMain.handle('get-temp-path', () => app.getPath('temp'));

app.on('window-all-closed', () => { app.quit(); });

app.on('will-quit', () => {
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  cleanupPartialFiles();
});
