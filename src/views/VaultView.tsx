import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { motion } from 'framer-motion';
import { Music, Trash2, Database } from 'lucide-react';

interface Props {
  onDeleteProject: (id: number) => void;
}

const VaultView: React.FC<Props> = ({ onDeleteProject }) => {
  const library = useLiveQuery(() => db.projects.orderBy('lastModified').reverse().toArray());

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="suite-view-container gap-10"
    >
      <div className="flex justify-between items-end shrink-0 relative z-10 px-2">
        <div className="flex flex-col gap-2">
          <h1 className="suite-glow-text text-7xl select-none italic">
            Entropy<br /><span className="text-[var(--color-primary)] opacity-20 not-italic">Library</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Local_Production_Archive</span>
        </div>

        <button onClick={() => window.electronAPI?.openMusicFolder()} className="suite-button suite-button-outline">
           Open Downloads Folder
        </button>
      </div>

      <div className="flex-1 p-10 overflow-y-auto custom-scrollbar relative z-10 suite-glass-deep rounded-[var(--radius-container)]">
        <div className="flex items-center gap-4 mb-8 px-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Collection</h2>
            <div className="suite-chip opacity-40">{library?.length || 0} ITEMS</div>
        </div>

        {library && library.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {library.map((project) => (
              <motion.div 
                key={project.id} 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-4 border border-[var(--color-outline)] flex items-center gap-6 transition-all group relative overflow-hidden bg-white/5 rounded-[var(--radius-element)] hover:border-[var(--color-primary)]/40 duration-300"
              >
                <div className="w-16 h-16 flex-shrink-0 overflow-hidden border border-[var(--color-outline)] rounded-[var(--radius-element)] bg-black/40 relative group-hover:border-[var(--color-primary)]/30 transition-all">
                  {project.coverArt ? (
                    <img src={project.coverArt} crossOrigin="anonymous" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-6 h-6 opacity-10" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-tight truncate">{project.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest truncate opacity-30">{project.artist || 'Unknown Origin'}</p>
                      <div className="w-1 h-1 rounded-full bg-[var(--color-outline)] opacity-20" />
                      <p className="text-[8px] font-mono opacity-20 truncate uppercase tracking-widest">{project.filePath || 'Internal_Buffer'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => project.filePath && window.electronAPI?.openFile(project.filePath)} 
                      disabled={!project.filePath}
                      className="suite-button suite-button-primary h-9 px-4 text-[9px] disabled:opacity-10"
                    >
                      Open in Player
                    </button>
                    <button 
                      onClick={() => project.filePath && window.electronAPI?.revealFile(project.filePath)} 
                      disabled={!project.filePath}
                      className="suite-button suite-button-outline h-9 px-4 text-[9px] disabled:opacity-10"
                    >
                      Explorer
                    </button>
                    <div className="w-px h-6 bg-[var(--color-outline)] mx-2 opacity-20" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id!); }} 
                      className="w-9 h-9 flex items-center justify-center transition-all rounded-[var(--radius-element)] hover:bg-red-500/20 text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
              <Database className="w-32 h-32 mb-8 stroke-[1]" />
              <h3 className="text-3xl font-black uppercase tracking-tighter">Library Empty</h3>
              <p className="text-sm font-bold uppercase tracking-[0.2em] mt-2">Ingest media to populate your library</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VaultView;
