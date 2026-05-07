import { Clock, User, Trash2, Download, Music } from 'lucide-react';
import { motion } from 'framer-motion';
import { StudioGlow } from './common/StudioGlow';
import { formatTime } from '../utils';

interface Props {
  info: {
    title: string;
    uploader: string;
    duration: number;
    thumbnail: string;
    webpage_url: string;
  };
  onRemove: () => void;
  onCommit: () => void;
  isProcessing: boolean;
}

const IngestStage: React.FC<Props> = ({ info, onRemove, onCommit, isProcessing }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="p-4 border-2 border-[var(--color-outline)] flex items-center gap-6 group transition-all bg-[var(--color-surface)] rounded-[var(--radius-container)] shadow-2xl hover:border-[var(--color-primary)] relative overflow-hidden"
    >
      <StudioGlow className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-15 transition-opacity" size="md" />
      <div className="w-24 h-24 overflow-hidden shrink-0 border-2 border-[var(--color-outline)] bg-[var(--color-surface)] rounded-[var(--radius-element)] relative">
        <img 
            src={info.thumbnail} 
            crossOrigin="anonymous"
            onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
            }}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            alt="" 
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none group-hover:opacity-30 transition-opacity">
            <Music className="w-8 h-8" />
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-xl font-black uppercase tracking-tighter truncate leading-tight mb-2 text-[var(--color-on-surface)]">{info.title}</h3>
        <div className="flex flex-wrap gap-4 opacity-80 text-[var(--color-on-surface)]">
          <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-widest">
            <User className="w-4 h-4 text-[var(--color-primary)]" /> {info.uploader}
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-widest">
            <Clock className="w-4 h-4 text-[var(--color-primary)]" /> {formatTime(info.duration)}
          </div>
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button 
          onClick={onRemove}
          disabled={isProcessing}
          className="w-12 h-12 flex items-center justify-center transition-all disabled:opacity-20 bg-red-500/10 text-red-500 rounded-[var(--radius-element)] hover:bg-red-500 hover:text-white"
          title="Discard"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button 
          onClick={onCommit}
          disabled={isProcessing}
          className="px-6 h-12 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 min-w-[160px] bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[var(--radius-element)] shadow-xl hover:scale-105 active:scale-95 shimmer"
        >
          <Download className="w-4 h-4" /> Add to Queue
        </button>
      </div>
    </motion.div>
  );
};


export default IngestStage;
