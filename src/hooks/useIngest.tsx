import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, type StagedItem, type QueueItem } from '../db/database';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToaster } from '../components/Toaster';

interface IngestContextType {
  stagedItems: StagedItem[];
  queue: QueueItem[];
  directProgress: Record<string, number>;
  speedMap: Record<string, string>;
  masterLogs: string[];
  isProcessing: boolean;
  isStaging: boolean;
  statusMessage: string | null;
  targetDirectory: string;
  concurrency: number;
  ingestMode: 'audio' | 'video';
  
  setIngestMode: (mode: 'audio' | 'video') => void;
  setTargetDirectory: (path: string) => void;
  setConcurrency: (n: number) => void;
  setMasterLogs: React.Dispatch<React.SetStateAction<string[]>>;
  
  handleSearch: (query: string, provider: 'youtube' | 'soundcloud') => Promise<any[]>;
  handleUnpack: (query: string) => Promise<void>;
  commitToQueue: (item: StagedItem) => Promise<void>;
  processQueue: (engineSettings: any) => Promise<void>;
  clearStaging: () => Promise<void>;
  clearQueue: () => Promise<void>;
  cancelAll: () => Promise<void>;
}

const IngestContext = createContext<IngestContextType | undefined>(undefined);

export const IngestProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [directProgress, setDirectProgress] = useState<Record<string, number>>({});
  const [speedMap, setSpeedMap] = useState<Record<string, string>>({});
  const [masterLogs, setMasterLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [targetDirectory, setTargetDirectory] = useState('');
  const [concurrency, setConcurrency] = useState(3);
  const [ingestMode, setIngestMode] = useState<'audio' | 'video'>('audio');

  const { toast } = useToaster();
  const isCancelledRef = useRef(false);

  const stagedItems = useLiveQuery(() => db.stagedItems.toArray()) || [];
  const queue = useLiveQuery(() => db.downloadQueue.toArray()) || [];

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMusicPath().then(setTargetDirectory);

      const unsubLogs = window.electronAPI.onYtdlpLog((msg: any) => {
        const text = typeof msg === 'string' ? msg : msg.data;
        setMasterLogs(prev => [...prev.slice(-200), text]);
      });

      const unsubProgress = window.electronAPI.onIngestProgress((data) => {
        if (data.percent !== undefined) {
          setDirectProgress(prev => ({ ...prev, [data.url]: data.percent! }));
        }
        if (data.speed) {
          setSpeedMap(prev => ({ ...prev, [data.url]: data.speed! }));
        }
      });

      return () => {
        unsubLogs();
        unsubProgress();
      };
    }
  }, []);

  const handleSearch = useCallback(async (query: string, provider: 'youtube' | 'soundcloud') => {
    if (!query.trim() || !window.electronAPI) return [];
    
    const proxy = localStorage.getItem('studio-proxy') || undefined;
    const prefix = provider === 'youtube' ? 'ytsearch20:' : 'scsearch20:';
    
    const res = await window.electronAPI.ytdlpGetInfo(`${prefix}${query}`, { proxy });
    if (res.success && res.infos) {
        return res.infos.map((info: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: info.title,
            uploader: info.uploader,
            url: info.webpage_url,
            thumbnail: info.thumbnail,
            duration: info.duration
        }));
    }
    return [];
  }, []);

  const handleUnpack = useCallback(async (query: string) => {
    const urls = query.split('\n').map(u => u.trim()).filter(u => u.startsWith('http') || u.includes('search:'));
    if (urls.length === 0) return;

    setIsStaging(true);
    for (const url of urls) {
      if (window.electronAPI) {
        const proxy = localStorage.getItem('studio-proxy') || undefined;
        setStatusMessage(`Preparing: ${url.substring(0, 30)}...`);
        const res = await window.electronAPI.ytdlpGetInfo(url, { proxy });
        if (res.success && res.infos) {
          const newStaged: StagedItem[] = res.infos.map((info: any) => ({
             id: Math.random().toString(36).substr(2, 9),
             url: info.webpage_url || url,
             info: info,
             addedAt: Date.now()
          }));
          await db.stagedItems.bulkAdd(newStaged);
        }
      }
    }
    setStatusMessage(null);
    setIsStaging(false);
  }, []);

  const commitToQueue = useCallback(async (item: StagedItem) => {
    await db.downloadQueue.add({
      id: item.id,
      url: item.url,
      title: item.info.title,
      uploader: item.info.uploader,
      status: 'idle',
      addedAt: Date.now()
    });
    await db.stagedItems.delete(item.id);
  }, []);

  const processQueue = useCallback(async (engineSettings: any) => {
    if (isProcessing || queue.length === 0) return;
    setIsProcessing(true);
    isCancelledRef.current = false;
    
    const itemsToProcess = [...queue.filter(q => q.status !== 'success' && q.status !== 'processing')];
    
    const runWorker = async () => {
      while (itemsToProcess.length > 0 && !isCancelledRef.current) {
        const item = itemsToProcess.shift();
        if (!item) break;

        await db.downloadQueue.update(item.id, { status: 'processing' });

        try {
            const proxy = localStorage.getItem('studio-proxy') || undefined;
            if (!window.electronAPI) throw new Error("Native Bridge Offline");
            const res = await window.electronAPI.ytdlpDownload(item.url, { 
                mode: ingestMode,
                destinationPath: targetDirectory,
                proxy,
                ...engineSettings
            });
            if (!res.success) throw new Error(res.error);
            await db.downloadQueue.update(item.id, { status: 'success' });
            
            // Auto-import to Vault
            if (res.filePath) {
                await db.projects.add({
                    name: item.title || 'Untitled',
                    artist: item.uploader || 'Unknown',
                    filePath: res.filePath,
                    lastModified: Date.now(),
                    sourceUrl: item.url,
                    mediaType: ingestMode
                });
            }

            toast(`Successfully Ingested: ${item.title || item.url}`, 'success');
            
            // Clean up progress maps on success
            setDirectProgress(prev => {
                const next = { ...prev };
                delete next[item.url];
                return next;
            });
            setSpeedMap(prev => {
                const next = { ...prev };
                delete next[item.url];
                return next;
            });
        } catch (e: any) {
            await db.downloadQueue.update(item.id, { status: 'error', error: e.message });
            toast(`Failed to Ingest: ${item.title || item.url}`, 'error');
        }
      }
    };

    const pool = Array.from({ length: Math.min(concurrency, itemsToProcess.length) }).map(() => runWorker());
    await Promise.all(pool);
    setIsProcessing(false);
  }, [isProcessing, queue, ingestMode, targetDirectory, concurrency]);

  const clearStaging = useCallback(async () => {
    await db.stagedItems.clear();
  }, []);

  const clearQueue = useCallback(async () => {
    await db.downloadQueue.clear();
  }, []);

  const cancelAll = useCallback(async () => {
    isCancelledRef.current = true;
    if (window.electronAPI) {
      await window.electronAPI.ytdlpCancel();
    }
    setIsProcessing(false);
  }, []);

  return (
    <IngestContext.Provider value={{
      stagedItems, queue, directProgress, speedMap, masterLogs, isProcessing, isStaging, statusMessage,
      targetDirectory, concurrency, ingestMode,
      setIngestMode, setTargetDirectory, setConcurrency, setMasterLogs,
      handleSearch, handleUnpack, commitToQueue, processQueue, clearStaging, clearQueue, cancelAll
    }}>
      {children}
    </IngestContext.Provider>
  );
};

export const useIngest = () => {
  const context = useContext(IngestContext);
  if (context === undefined) {
    throw new Error('useIngest must be used within an IngestProvider');
  }
  return context;
};
