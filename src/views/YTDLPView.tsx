import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CloudDownload, Loader2, CheckCircle2, AlertTriangle, Search, 
  Activity, Play, Music, ListPlus, Terminal
} from 'lucide-react';
import IngestStage from '../components/IngestStage';
import { useIngest } from '../hooks/useIngest';
import { db } from '../db/database';
import { cn, formatTime } from '../utils';
import { useToaster } from '../components/Toaster';

interface SearchResult {
  id: string;
  title: string;
  uploader: string;
  url: string;
  thumbnail: string;
  duration: number;
}

interface Props {
  engineSettings: { connections: number; splits: number; userAgent: string };
}

const YTDLPView: React.FC<Props> = ({ engineSettings }) => {
  const {
    stagedItems, queue, directProgress, speedMap, masterLogs, isProcessing, isStaging, statusMessage,
    targetDirectory, concurrency, ingestMode,
    setIngestMode, setTargetDirectory, setConcurrency, setMasterLogs,
    handleSearch, handleUnpack, commitToQueue, processQueue, clearStaging, clearQueue, cancelAll
  } = useIngest();
  const { toast } = useToaster();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchProvider, setSearchProvider] = useState<'youtube' | 'soundcloud'>('youtube');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const [systemCheck, setSystemCheck] = useState({ ytdlp: false, ffmpeg: false, aria2: false });

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.checkSystemBinary().then(check => setSystemCheck(check));
    }
  }, []);

  useEffect(() => {
    if (showLogs) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [masterLogs, showLogs]);

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await handleSearch(searchQuery, searchProvider);
    if (results.length === 0) {
        toast(`No results found for "${searchQuery}"`, 'warning');
    } else {
        toast(`Found ${results.length} results`, 'success');
    }
    setSearchResults(results);
    setIsSearching(false);
  };

  const onUnpack = async (url?: string) => {
    const target = url || searchQuery;
    if (!target) return;
    await handleUnpack(target);
    setSearchQuery('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
      {/* Header Bar */}
      <header className="px-10 py-6 border-b border-[var(--color-outline)] flex items-center justify-between shrink-0 suite-glass-subtle z-20">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="text-3xl suite-glow-text italic uppercase">Entropy<span className="text-[var(--color-primary)] opacity-40 not-italic ml-1">Ingest</span></h1>
            <div className="flex items-center gap-3 mt-1">
               <BinaryStatus label="YT-DLP" active={systemCheck.ytdlp} />
               <BinaryStatus label="ARIA2" active={systemCheck.aria2} />
               <BinaryStatus label="FFMPEG" active={systemCheck.ffmpeg} />
               <div className="h-3 w-px bg-[var(--color-outline)] mx-1 opacity-20" />
               <span className="text-[7px] font-mono font-black uppercase tracking-[0.2em] opacity-40">Native Core 2.0</span>
            </div>
          </div>
          
          <AnimatePresence>
            {(statusMessage || isProcessing) && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="px-3 py-1.5 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[8px] font-black uppercase tracking-widest rounded-[var(--radius-element)] flex items-center gap-2 shadow-lg">
                <Loader2 className="w-3 h-3 animate-spin" />
                {statusMessage || 'Download Engine Active'}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex bg-[var(--color-surface-variant)] p-1 rounded-[var(--radius-element)] border border-[var(--color-outline)] gap-1">
                {(['audio', 'video'] as const).map(m => (
                    <button key={m} onClick={() => setIngestMode(m)} className={cn("px-4 py-1.5 rounded-[var(--radius-element)] text-[8px] font-black uppercase tracking-widest transition-all", ingestMode === m ? "bg-[var(--color-on-surface)] text-[var(--color-surface)]" : "opacity-30 hover:opacity-100")}>{m}</button>
                ))}
            </div>
            
            <button onClick={() => window.electronAPI?.selectDownloadDirectory().then(p => p && setTargetDirectory(p))} className="suite-button-ghost text-[8px] opacity-40 hover:opacity-100 uppercase">
              Folder: {targetDirectory ? targetDirectory.split(/[\\/]/).pop() : 'Default'}
            </button>

            <button 
                onClick={() => setShowLogs(!showLogs)} 
                className={cn("w-10 h-10 flex items-center justify-center rounded-[var(--radius-element)] border transition-all", showLogs ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-transparent" : "border-[var(--color-outline)] opacity-40 hover:opacity-100")}
            >
                <Terminal className="w-4 h-4" />
            </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar p-10 gap-12">
            
            {/* Search & Input Hub */}
            <section className="max-w-5xl mx-auto w-full sticky top-0 z-30">
                <div className="flex items-center gap-4 suite-glass-deep p-3 rounded-[var(--radius-container)] shadow-2xl border border-[var(--color-outline)]">
                    <div className="flex gap-1 shrink-0 px-2 border-r border-[var(--color-outline)]/40">
                        <button onClick={() => setSearchProvider('youtube')} className={cn("p-2.5 rounded-lg transition-all", searchProvider === 'youtube' ? "bg-red-500/20 text-red-500" : "opacity-20 hover:opacity-100")}><Play className="w-5 h-5" /></button>
                        <button onClick={() => setSearchProvider('soundcloud')} className={cn("p-2.5 rounded-lg transition-all", searchProvider === 'soundcloud' ? "bg-orange-500/20 text-orange-500" : "opacity-20 hover:opacity-100")}><Music className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition-opacity" />
                        <input 
                            type="text"
                            placeholder="URL, Search Terms, or Direct File Link..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const isDirect = /\.(mp4|mkv|zip|rar|iso|exe|mov|wav|flac|mp3|pdf)$/i.test(searchQuery);
                                    if (isDirect) {
                                        if (!systemCheck.aria2) {
                                            toast('Aria2 engine missing. Please install to engage direct links.', 'error');
                                            return;
                                        }
                                        window.electronAPI?.aria2Download(searchQuery, targetDirectory, engineSettings);
                                        toast('Direct Engagement Initiated', 'info');
                                        setSearchQuery('');
                                    } else if (searchQuery.startsWith('http')) {
                                        onUnpack();
                                    } else {
                                        onSearch();
                                    }
                                }
                            }}
                            className="suite-hub-input !pl-12 !text-xs"
                        />
                    </div>
                    <div className="flex gap-2 pr-1">
                        <button onClick={onSearch} disabled={isSearching} className="suite-button suite-button-primary px-6 h-10 text-[9px]">
                            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                        </button>
                        <button 
                            onClick={() => {
                                const isDirect = /\.(mp4|mkv|zip|rar|iso|exe|mov|wav|flac|mp3|pdf)$/i.test(searchQuery);
                                if (isDirect) {
                                    window.electronAPI?.aria2Download(searchQuery, targetDirectory, engineSettings);
                                    setSearchQuery('');
                                } else {
                                    onUnpack();
                                }
                            }} 
                            disabled={isStaging || !searchQuery.startsWith('http')}
                            className={cn("suite-button px-6 h-10 text-[9px] border-[var(--color-outline)] suite-button-outline", searchQuery.startsWith('http') ? "!opacity-100" : "")}
                        >
                            {isStaging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Prepare'}
                        </button>
                    </div>
                </div>
            </section>

            {/* Content Area */}
            <div className="flex flex-col gap-16 max-w-5xl mx-auto w-full">
                
                {/* Search Results */}
                <AnimatePresence>
                    {searchResults.length > 0 && (
                        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col gap-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Discovery Feed</h3>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={async () => {
                                            for (const result of searchResults) await onUnpack(result.url);
                                            setSearchResults([]);
                                        }} 
                                        className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                                    >
                                        Prepare All
                                    </button>
                                    <button onClick={() => setSearchResults([])} className="text-[9px] font-black uppercase tracking-widest opacity-20 hover:opacity-100 transition-opacity">Dismiss</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {searchResults.map(result => (
                                    <div key={result.id} className="suite-card group flex flex-col h-full">
                                        <div className="aspect-video relative overflow-hidden bg-black/40">
                                            <img src={result.thumbnail} crossOrigin="anonymous" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                <button onClick={() => onUnpack(result.url)} className="p-3 bg-white text-black rounded-full hover:scale-110 active:scale-95 transition-all"><ListPlus className="w-5 h-5" /></button>
                                            </div>
                                            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-[8px] font-mono rounded">{formatTime(result.duration)}</div>
                                        </div>
                                        <div className="p-3 flex flex-col gap-1">
                                            <h4 className="text-[10px] font-black uppercase truncate text-white">{result.title}</h4>
                                            <p className="text-[8px] font-mono opacity-40 uppercase tracking-widest truncate">{result.uploader}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* Staging Area */}
                <AnimatePresence>
                    {stagedItems.length > 0 && (
                        <motion.section initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-6">
                            <div className="flex items-center justify-between px-2">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Preparation Bay ({stagedItems.length})</h3>
                                <div className="flex gap-4">
                                    <button onClick={clearStaging} className="text-[9px] font-black uppercase opacity-20 hover:opacity-100">Clear</button>
                                    <button onClick={async () => {
                                        for (const item of stagedItems) await commitToQueue(item);
                                    }} className="suite-button suite-button-primary px-6 h-8 text-[8px]">Queue All</button>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                {stagedItems.map(item => (
                                    <IngestStage key={item.id} info={item.info} onRemove={() => db.stagedItems.delete(item.id)} onCommit={() => commitToQueue(item)} isProcessing={isProcessing} />
                                ))}
                            </div>
                        </motion.section>
                    )}
                </AnimatePresence>

                {/* Queue Manager */}
                <section className="flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40">Download Queue ({queue.length})</h3>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3 bg-[var(--color-surface-variant)] px-3 py-1.5 rounded-[var(--radius-element)] border border-[var(--color-outline)]">
                                <Activity className="w-3 h-3 opacity-30" />
                                <div className="flex gap-1.5">
                                    {[1, 3, 5, 8].map(n => (
                                        <button key={n} onClick={() => setConcurrency(n)} className={cn("w-5 h-5 rounded text-[8px] font-black transition-all", concurrency === n ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100")}>{n}</button>
                                    ))}
                                </div>
                            </div>
                            {queue.length > 0 && (
                                <div className="flex gap-3">
                                    <button onClick={clearQueue} className="text-[9px] font-black uppercase opacity-20 hover:text-red-500 hover:opacity-100 transition-all">Purge</button>
                                    {isProcessing ? (
                                        <button onClick={cancelAll} className="suite-button bg-red-500 text-white px-6 h-10 text-[9px] shadow-lg">Stop All</button>
                                    ) : (
                                        <button onClick={() => processQueue(engineSettings)} className="suite-button suite-button-primary px-8 h-10 text-[9px] shadow-2xl">Start Downloads</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {queue.length === 0 ? (
                            <div className="py-20 border-2 border-dashed border-[var(--color-outline)]/40 rounded-[var(--radius-container)] flex flex-col items-center justify-center opacity-10">
                                <CloudDownload className="w-10 h-10 mb-4" />
                                <p className="font-black uppercase tracking-[0.5em] text-[8px]">Awaiting Instructions</p>
                            </div>
                        ) : (
                            queue.map(item => (
                                <QueueListItem key={item.id} item={item} progress={directProgress[item.url]} speed={speedMap[item.url]} />
                            ))
                        )}
                    </div>
                </section>
            </div>
        </main>

        {/* Master Log Sidebar */}
        <AnimatePresence>
            {showLogs && (
                <motion.aside 
                    initial={{ x: '100%' }} 
                    animate={{ x: 0 }} 
                    exit={{ x: '100%' }} 
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="w-96 border-l border-[var(--color-outline)] flex flex-col shrink-0 bg-black/60 backdrop-blur-3xl z-40"
                >
                    <div className="p-6 border-b border-[var(--color-outline)] flex items-center justify-between bg-black/20">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] opacity-80">System Output</span>
                        </div>
                        <button onClick={() => setMasterLogs([])} className="text-[8px] font-black uppercase opacity-40 hover:opacity-100">Clear</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 font-mono text-[8px] custom-scrollbar space-y-3">
                        {masterLogs.map((log, i) => (
                            <div key={i} className="opacity-70 border-l border-[var(--color-primary)]/40 pl-3 py-1 break-all leading-relaxed">{log}</div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const BinaryStatus: React.FC<{ label: string; active: boolean }> = ({ label, active }) => (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-[var(--color-outline)]/40 rounded">
        <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm", active ? "bg-green-500 shadow-green-500/50" : "bg-red-500 shadow-red-500/50")} />
        <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{label}</span>
    </div>
);

const QueueListItem: React.FC<{ item: any; progress?: number; speed?: string }> = ({ item, progress, speed }) => (
    <div className={cn(
        "p-5 rounded-[var(--radius-container)] border transition-all duration-500 relative overflow-hidden",
        item.status === 'processing' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xl border-transparent" : "suite-card"
    )}>
        {item.status === 'processing' && (
            <motion.div 
                initial={{ x: '-100%' }} 
                animate={{ x: '100%' }} 
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} 
                className="absolute inset-0 bg-white/10 pointer-events-none" 
                style={{ width: '40%', filter: 'blur(60px)' }} 
            />
        )}
        <div className="flex items-center gap-6 relative z-10">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", item.status === 'processing' ? "bg-black/20" : "bg-white/5")}>
                {item.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                 item.status === 'success' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : 
                 item.status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : 
                 <CloudDownload className="w-4 h-4 opacity-20" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-0.5">
                    <h4 className="text-[11px] font-black uppercase truncate tracking-tight">{item.title || item.url}</h4>
                    {item.status === 'processing' && progress !== undefined && (
                        <div className="flex items-center gap-3">
                            <span className="text-[8px] font-mono font-bold opacity-70 uppercase tracking-widest">{speed || '...'}</span>
                            <span className="text-[10px] font-mono font-black">{item.status === 'processing' ? 'Downloading' : item.status === 'success' ? 'Completed' : 'Queued'} {progress !== undefined ? `${progress.toFixed(1)}%` : ''}</span>
                        </div>
                    )}
                </div>
                <p className={cn("text-[8px] font-mono uppercase tracking-widest truncate", item.status === 'processing' ? "opacity-70" : "opacity-40")}>
                    {item.status === 'error' ? `Error: ${item.error}` : item.status === 'success' ? 'Ready in Library' : item.uploader || 'Awaiting Metadata'}
                </p>
            </div>
        </div>
        {item.status === 'processing' && progress !== undefined && (
            <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${progress}%` }} 
                    className="h-full bg-white shadow-[0_0_10px_white]" 
                />
            </div>
        )}
    </div>
);



export default YTDLPView;
