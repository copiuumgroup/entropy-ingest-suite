import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudDownload, Loader2, CheckCircle2, AlertTriangle, Search, Activity, Play, Music, ListPlus, Trash2, ExternalLink } from 'lucide-react';
import IngestStage from '../components/IngestStage';
import { studioAPI } from '../services/engine/MaterialStudioAPI';

interface StagedItem {
  id: string;
  url: string;
  info: any;
}

interface QueueItem {
  id: string;
  url: string;
  title?: string;
  uploader?: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
}

interface SearchResult {
  id: string;
  title: string;
  uploader: string;
  url: string;
  thumbnail: string;
  duration: number;
}

const YTDLPView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'search' | 'urls' | 'queue'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProvider, setSearchProvider] = useState<'youtube' | 'soundcloud'>('youtube');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [cloudUrls, setCloudUrls] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  
  const [masterLogs, setMasterLogs] = useState<string[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [ingestMode, setIngestMode] = useState<'audio' | 'video'>('audio');
  const [targetDirectory, setTargetDirectory] = useState<string>('');
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMusicPath().then(path => setTargetDirectory(path));
    }
  }, []);

  useEffect(() => {
    const unsubDownloads = studioAPI.subscribeToDownloads((data) => {
      setMasterLogs(prev => [...prev.slice(-100), data]);
      const progressMatch = data.match(/(\d+\.?\d*)%/);
      if (progressMatch) setOverallProgress(parseFloat(progressMatch[1]));
    });
    return () => { unsubDownloads(); };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [masterLogs]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !window.electronAPI) return;
    setIsSearching(true);
    setSearchResults([]);
    
    const prefix = searchProvider === 'youtube' ? 'ytsearch20:' : 'scsearch20:';
    const res = await window.electronAPI.ytdlpGetInfo(`${prefix}${searchQuery}`);
    if (res.success && res.infos) {
      const results = res.infos.map((info: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: info.title,
        uploader: info.uploader,
        url: info.webpage_url,
        thumbnail: info.thumbnail?.replace('http:', 'https:'),
        duration: info.duration
      }));
      setSearchResults(results);
    } else {
      setStatusMessage(`Search failed: ${res.error}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
    setIsSearching(false);
  };

  const handleUnpack = async (urlToUnpack?: string) => {
    const urls = urlToUnpack 
      ? [urlToUnpack] 
      : cloudUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http') || u.includes('search:'));
    
    if (urls.length === 0) return;

    setIsStaging(true);
    setCloudUrls('');
    
    for (const url of urls) {
      if (window.electronAPI) {
        setStatusMessage(`Analyzing: ${url.substring(0, 30)}...`);
      const res = await window.electronAPI.ytdlpGetInfo(url);
      if (res.success && res.infos) {
        const newStaged = res.infos.map((info: any) => ({
           id: Math.random().toString(36).substr(2, 9),
           url: info.webpage_url || url,
           info: {
             ...info,
             thumbnail: info.thumbnail?.replace('http:', 'https:') // Ensure HTTPS for CSP
           }
        }));
        setStagedItems(prev => [...prev, ...newStaged]);
      }
      }
    }
    setStatusMessage(null);
    setIsStaging(false);
    if (stagedItems.length > 0 || urls.length > 0) setActiveTab('urls');
  };

  const commitToQueue = (item: StagedItem) => {
    setQueue(prev => [...prev, {
      id: item.id,
      url: item.url,
      title: item.info.title,
      uploader: item.info.uploader,
      status: 'idle'
    }]);
    setStagedItems(prev => prev.filter(s => s.id !== item.id));
  };

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;
    setIsProcessing(true);
    isCancelledRef.current = false;
    
    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (isCancelledRef.current || item.status === 'success') continue;
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

        try {
            if (!window.electronAPI) throw new Error("Native Bridge Offline");
            const res = await window.electronAPI.ytdlpDownload(item.url, { 
                mode: ingestMode,
                destinationPath: targetDirectory
            });
            if (!res.success) throw new Error(res.error);
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
        } catch (e: any) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
        }
    }
    setIsProcessing(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col min-h-0 bg-[var(--color-surface)]">
      {/* Dynamic Navigation Header */}
      <div className="px-10 pt-10 pb-6 border-b border-[var(--color-outline)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black uppercase tracking-tighter">yt-dlp<span className="text-[var(--color-primary)] opacity-40">Engine</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <CloudDownload className="w-3 h-3 text-[var(--color-primary)]" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">System Ready</span>
            </div>
          </div>

          <AnimatePresence>
            {statusMessage && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="px-4 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[8px] font-black uppercase tracking-widest rounded-[var(--radius-element)] flex items-center gap-2 shadow-xl">
                <Loader2 className="w-3 h-3 animate-spin" />
                {statusMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <nav className="flex items-center bg-[var(--color-surface-variant)] rounded-[var(--radius-element)] p-1 border border-[var(--color-outline)]">
            {(['search', 'urls', 'queue'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2 rounded-[var(--radius-element)] text-[10px] font-black uppercase tracking-widest transition-all",
                  activeTab === tab ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-30 hover:opacity-100"
                )}
              >
                {tab} {tab === 'urls' && stagedItems.length > 0 && `(${stagedItems.length})`}
                {tab === 'queue' && queue.length > 0 && `(${queue.length})`}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex bg-[var(--color-surface-variant)] p-1 rounded-[var(--radius-element)] border border-[var(--color-outline)] gap-1">
                {(['audio', 'video'] as const).map(m => (
                    <button key={m} onClick={() => setIngestMode(m)} className={cn("px-4 py-1.5 rounded-[var(--radius-element)] text-[9px] font-black uppercase tracking-widest transition-all", ingestMode === m ? "bg-[var(--color-on-surface)] text-[var(--color-surface)]" : "opacity-30 hover:opacity-100")}>{m}</button>
                ))}
            </div>
            <button onClick={() => window.electronAPI?.selectDownloadDirectory().then(p => p && setTargetDirectory(p))} className="suite-button-ghost text-[9px] opacity-40 hover:opacity-100">
              Vault: {targetDirectory ? targetDirectory.split('\\').pop() : 'Default'}
            </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-10">
          <AnimatePresence mode="wait">
            {activeTab === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-8 max-w-6xl mx-auto w-full">
                <div className="flex flex-col gap-6 items-center text-center">
                  <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">Global Discovery</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">YouTube & SoundCloud Indexing</p>
                </div>

                <div className="flex items-center gap-4 bg-[var(--color-surface-variant)] p-4 rounded-[var(--radius-container)] border border-[var(--color-outline)] shadow-2xl">
                  <div className="flex gap-2 shrink-0 pr-4 border-r border-[var(--color-outline)]">
                    <button onClick={() => setSearchProvider('youtube')} className={cn("p-2 rounded-full transition-all", searchProvider === 'youtube' ? "bg-red-500/20 text-red-500" : "opacity-20 hover:opacity-100")}><Play className="w-5 h-5" /></button>
                    <button onClick={() => setSearchProvider('soundcloud')} className={cn("p-2 rounded-full transition-all", searchProvider === 'soundcloud' ? "bg-orange-500/20 text-orange-500" : "opacity-20 hover:opacity-100")}><Music className="w-5 h-5" /></button>
                  </div>
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input 
                      type="text"
                      placeholder={`Search ${searchProvider === 'youtube' ? 'YouTube' : 'SoundCloud'} terms...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full bg-transparent border-none outline-none pl-12 pr-4 py-2 font-black uppercase tracking-widest text-sm"
                    />
                  </div>
                  <button onClick={handleSearch} disabled={isSearching} className="suite-button suite-button-primary px-8">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {searchResults.map(result => (
                    <motion.div key={result.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="suite-card group overflow-hidden flex flex-col">
                      <div className="aspect-video bg-[var(--color-surface)] relative overflow-hidden">
                        {result.thumbnail ? <img src={result.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center opacity-10"><Play className="w-12 h-12" /></div>}
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-[8px] font-black rounded backdrop-blur-md">{Math.floor(result.duration/60)}:{(result.duration%60).toString().padStart(2,'0')}</div>
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        <h4 className="text-[10px] font-black uppercase truncate leading-tight" title={result.title}>{result.title}</h4>
                        <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{result.uploader}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => handleUnpack(result.url)} className="flex-1 suite-button-primary text-[8px] py-1.5 rounded-[var(--radius-element)] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            <ListPlus className="w-3 h-3" /> Stage
                          </button>
                          <button onClick={() => window.open(result.url)} className="p-2 border border-[var(--color-outline)] rounded-[var(--radius-element)] hover:bg-[var(--color-on-surface)] hover:text-[var(--color-surface)] transition-all">
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'urls' && (
              <motion.div key="urls" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
                <div className="suite-card p-10 flex flex-col gap-8">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Bulk Link Importer</h2>
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-30">Paste Playlists, Albums, or Multiple URLs</p>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      value={cloudUrls}
                      onChange={(e) => setCloudUrls(e.target.value)}
                      placeholder="https://youtube.com/playlist?list=...&#10;https://soundcloud.com/user/track-123..."
                      className="w-full h-48 suite-input resize-none p-8 font-mono text-[11px]"
                    />
                    <button onClick={() => handleUnpack()} disabled={isStaging || !cloudUrls} className="absolute bottom-6 right-6 suite-button suite-button-primary">
                      {isStaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />} Stage All
                    </button>
                  </div>
                </div>

                {stagedItems.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Selected Items ({stagedItems.length})</h3>
                      <button onClick={() => {
                        const newItems = stagedItems.map(item => ({ id: item.id, url: item.url, title: item.info.title, uploader: item.info.uploader, status: 'idle' as const }));
                        setQueue(prev => [...prev, ...newItems]);
                        setStagedItems([]);
                        setActiveTab('queue');
                      }} className="suite-button suite-button-primary px-8 py-3 text-[9px]">Move to Download Queue</button>
                    </div>
                    <div className="flex flex-col gap-4">
                       {stagedItems.map(item => (
                         <IngestStage key={item.id} info={item.info} onRemove={() => setStagedItems(prev => prev.filter(s => s.id !== item.id))} onCommit={() => commitToQueue(item)} isProcessing={isProcessing} />
                       ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex flex-col gap-8 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Download Queue</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">{queue.length} Tasks Scheduled</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setQueue([])} className="suite-button-ghost text-red-500 opacity-40 hover:opacity-100">
                      <Trash2 className="w-4 h-4" /> Purge Queue
                    </button>
                    <button onClick={processQueue} disabled={isProcessing || queue.length === 0} className="suite-button suite-button-primary px-10 py-4">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />} Run Batch Process
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {queue.length === 0 ? (
                    <div className="py-20 border border-dashed border-[var(--color-outline)] rounded-[var(--radius-container)] flex flex-col items-center opacity-20">
                      <CloudDownload className="w-12 h-12 mb-4" />
                      <p className="font-black uppercase tracking-[0.5em] text-[10px]">Queue Empty</p>
                    </div>
                  ) : (
                    queue.map(item => (
                      <div key={item.id} className={cn("p-6 rounded-[var(--radius-container)] border flex items-center gap-6 transition-all duration-500", item.status === 'processing' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xl scale-[1.02] border-transparent" : "suite-card")}>
                        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", item.status === 'success' ? "bg-green-500/10 text-green-500" : "bg-[var(--color-surface)]")}>
                          {item.status === 'processing' ? <Loader2 className="w-5 h-5 animate-spin" /> : item.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : item.status === 'error' ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <CloudDownload className="w-5 h-5 opacity-20" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="text-xs font-black uppercase truncate tracking-tight">{item.title || item.url}</h4>
                           <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest mt-1">{item.uploader || 'Awaiting Metadata'}</p>
                        </div>
                        {item.status === 'error' && <p className="text-[8px] text-red-500 font-bold uppercase max-w-[200px] truncate">{item.error}</p>}
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Feed */}
        <div className="w-96 border-l border-[var(--color-outline)] flex flex-col shrink-0 bg-[var(--color-surface)]/40 backdrop-blur-md">
           <div className="p-8 border-b border-[var(--color-outline)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-[10px] font-black uppercase tracking-widest">Feed</span>
              </div>
              {isProcessing && <div className="text-[10px] font-mono text-[var(--color-primary)]">{overallProgress}%</div>}
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 font-mono text-[9px] custom-scrollbar">
              {masterLogs.map((log, i) => (
                <div key={i} className="mb-2 opacity-40 border-l border-[var(--color-outline)] pl-3 py-0.5">{log}</div>
              ))}
              <div ref={logEndRef} />
           </div>

           {isProcessing && (
              <div className="h-1.5 w-full bg-[var(--color-outline)] relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${overallProgress}%` }} className="absolute h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]" />
              </div>
           )}
        </div>
      </div>
    </motion.div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default YTDLPView;
