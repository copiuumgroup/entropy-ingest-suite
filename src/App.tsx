import { useState, useEffect, lazy, Suspense } from 'react';
const HomeView = lazy(() => import('./views/HomeView'));
const VaultView = lazy(() => import('./views/VaultView'));
const YTDLPView = lazy(() => import('./views/YTDLPView'));
import SidebarRail from './components/SidebarRail';
import { SettingsModal } from './components/SettingsModal';
import type { ViewType } from './components/SidebarRail';
import { db } from './db/database';
import { AnimatePresence, motion } from 'framer-motion';
import MatrixBackground from './components/common/MatrixBackground';
import { useDesignSystem } from './hooks/useDesignSystem';
import { IngestProvider } from './hooks/useIngest';

declare global {
  interface Window {
    electronAPI?: {
      getMusicPath: () => Promise<string>;
      getMetadata: (path: string) => Promise<{ title?: string; artist?: string; album?: string; coverArt?: string } | null>;
      saveFile: (fileName: string, buffer: ArrayBuffer) => Promise<string>;
      selectDownloadDirectory: () => Promise<string | null>;
      ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav'; mode?: 'audio' | 'video'; destinationPath?: string; proxy?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      ytdlpGetInfo: (url: string, options?: { proxy?: string }) => Promise<{ success: boolean; info?: any; infos?: any[]; error?: string }>;
      ytdlpCancel: () => Promise<boolean>;
      aria2Download: (url: string, destinationPath?: string, options?: { connections?: number; splits?: number; userAgent?: string }) => Promise<{ success: boolean; error?: string }>;
      onIngestProgress: (callback: (data: { url: string; percent?: number; speed?: string }) => void) => () => void;
      openMusicFolder: () => Promise<boolean>;
      openAppDataFolder: () => Promise<boolean>;
      checkSystemBinary: () => Promise<{ ytdlp: boolean; ffmpeg: boolean; dotnet: boolean; aria2: boolean }>;
      purgeArchives: () => Promise<boolean>;
      getEngineMetrics: () => Promise<{ cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number }>;
      readFile: (path: string) => Promise<ArrayBuffer | null>;
      cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => Promise<string | null>;
      extractAudio: (path: string) => Promise<ArrayBuffer | null>;
      onYtdlpLog: (callback: (data: string | { data: string }) => void) => () => void;
      updateTitleBarOverlay: (settings: { color: string; symbolColor: string; height?: number }) => Promise<boolean>;
      getSystemAccent: () => Promise<string>;
      getTempPath: () => Promise<string>;
      setZoomFactor: (factor: number) => void;
      openFile: (filePath: string) => Promise<boolean>;
      revealFile: (filePath: string) => Promise<boolean>;
    };
  }
}

function App() {
  useDesignSystem();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [proxy, setProxy] = useState(localStorage.getItem('proxy') || '');
  const [engineSettings, setEngineSettings] = useState(() => {
    const saved = localStorage.getItem('engine-settings');
    return saved ? JSON.parse(saved) : { connections: 16, splits: 16, userAgent: 'Mozilla/5.0' };
  });

  // Persist settings
  useEffect(() => localStorage.setItem('proxy', proxy), [proxy]);
  useEffect(() => localStorage.setItem('engine-settings', JSON.stringify(engineSettings)), [engineSettings]);
  useEffect(() => { localStorage.setItem('studio-proxy', proxy); }, [proxy]);

  const [currentView, setCurrentView] = useState<ViewType>(() => (localStorage.getItem('last-view') as ViewType) || 'home');
  useEffect(() => localStorage.setItem('last-view', currentView), [currentView]);

  const [showTelemetry, setShowTelemetry] = useState(() => localStorage.getItem('show-telemetry') === 'true');
  useEffect(() => localStorage.setItem('show-telemetry', showTelemetry.toString()), [showTelemetry]);

  const [hardwareMetrics, setHardwareMetrics] = useState<{ cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number } | null>(null);

  useEffect(() => {
    if (!window.electronAPI) return;
    const interval = setInterval(async () => {
        const stats = await window.electronAPI!.getEngineMetrics();
        setHardwareMetrics(stats);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); adjustZoom(0.05); } 
        else if (e.key === '-') { e.preventDefault(); adjustZoom(-0.05); } 
        else if (e.key === '0') {
          e.preventDefault();
          if (window.electronAPI) {
            window.electronAPI.setZoomFactor(1.0);
            localStorage.setItem('ui-scale', '1.0');
          }
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) { e.preventDefault(); adjustZoom(e.deltaY < 0 ? 0.05 : -0.05); }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const adjustZoom = (delta: number) => {
    if (window.electronAPI) {
      const current = parseFloat(localStorage.getItem('ui-scale') || '1.0');
      const next = Math.min(Math.max(current + delta, 0.4), 2.5);
      window.electronAPI.setZoomFactor(next);
      localStorage.setItem('ui-scale', next.toString());
    }
  };

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.updateTitleBarOverlay({ color: '#000000', symbolColor: '#ffffff' });
      const savedScale = localStorage.getItem('ui-scale');
      if (savedScale) window.electronAPI.setZoomFactor(parseFloat(savedScale));
    }
    document.documentElement.className = '';
  }, []);

  return (
    <IngestProvider>
      <div className="w-full h-screen overflow-hidden flex transition-all duration-1000 is-windows bg-[var(--color-surface)]">
        <div className="fixed top-0 left-0 w-[calc(100%-144px)] h-[38px] title-bar-drag z-[100]" />
        
        <SidebarRail 
          currentView={currentView} 
          setView={setCurrentView} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          hardwareMetrics={showTelemetry ? hardwareMetrics : null}
        />

        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          proxy={proxy}
          setProxy={setProxy}
          engineSettings={engineSettings}
          setEngineSettings={setEngineSettings}
          showTelemetry={showTelemetry}
          setShowTelemetry={setShowTelemetry}
        />

        <main className="flex-1 flex flex-col relative overflow-hidden bg-transparent pt-[38px]">
          <div className="flex-1 overflow-hidden relative z-10">
          <AnimatePresence mode="wait">
          <Suspense fallback={
              <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                  <div className="w-16 h-1 bg-[var(--color-primary)] animate-pulse" />
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.5em]">Linking_Chunks...</p>
              </div>
          }>
            <motion.div
              key={currentView}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full h-full flex flex-col"
            >
            {currentView === 'home' && (
              <HomeView key="home" onNavigate={setCurrentView} />
            )}
            {currentView === 'vault' && (
              <VaultView 
                key="library"
                onDeleteProject={async (id) => await db.projects.delete(id)}
              />
            )}
            {currentView === 'yt-dlp' && (
              <YTDLPView 
                  key="yt-dlp" 
                  engineSettings={engineSettings} 
              />
            )}
            </motion.div>
            </Suspense>
          </AnimatePresence>
          </div>

          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden pb-16">
              <MatrixBackground />
          </div>

          <div className="suite-noise-overlay" />
          <div className="suite-scanline-grid" />
        </main>
      </div>
    </IngestProvider>
  );
}

export default App;

