import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Activity, ArrowRight } from 'lucide-react';
import { db } from '../db/database';
import type { ViewType } from '../components/SidebarRail';

interface HomeViewProps {
  onNavigate: (view: ViewType) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const [vaultStats, setVaultStats] = React.useState<{ count: number; path: string }>({ count: 0, path: '' });

  React.useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMusicPath().then(path => {
        setVaultStats(prev => ({ ...prev, path }));
      });
      db.projects.count().then(count => {
        setVaultStats(prev => ({ ...prev, count }));
      });
    }
  }, []);

  const cards = [
    {
      id: 'yt-dlp',
      title: 'Direct Ingest',
      description: 'Discovery engine for YouTube and SoundCloud. High-velocity multi-threaded ingestion.',
      icon: Globe,
      color: 'text-blue-400',
      action: () => onNavigate('yt-dlp'),
      available: true
    },
    {
      id: 'vault',
      title: 'Media Folder',
      description: 'Manage your local production assets. Instant handoff to VLC, MPV, or system explorer.',
      icon: Activity,
      color: 'text-emerald-400',
      action: () => onNavigate('vault'),
      available: true
    }
  ];

  return (
    <div className="suite-view-container items-center justify-center text-center">
      {/* Header Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-16 mt-8 flex flex-col items-center"
      >
        <div className="flex items-center gap-4 mb-6">
            <div className="px-3 py-1 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] font-black uppercase tracking-[0.4em] rounded-full">System_Active</div>
            <div className="h-px w-12 bg-[var(--color-outline)]" />
            <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest">Entropy Protocol v2.0</div>
        </div>
        <h1 className="text-8xl suite-glow-text mb-4 italic">
          Entropy <span className="text-[var(--color-primary)] opacity-80 not-italic">HUB</span>
        </h1>
        <p className="text-lg opacity-60 font-medium max-w-2xl text-[var(--color-on-surface)] leading-relaxed">
          High-velocity media ingestion and discovery environment. Automated metadata tagging and local library management for sound design and production.
        </p>

        <div className="mt-10 flex gap-8">
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-1">Local_Archive</span>
                <span className="text-2xl font-mono font-black">{vaultStats.count} <span className="text-xs opacity-20">ITEMS</span></span>
            </div>
            <div className="w-px h-10 bg-[var(--color-outline)] opacity-20" />
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-1">Storage_Path</span>
                <span className="text-2xl font-mono font-black uppercase">{vaultStats.path.split('\\').pop() || 'DEFAULT'}</span>
            </div>
        </div>
      </motion.div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        {cards.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ 
              delay: 0.2 + idx * 0.1,
              type: 'spring',
              stiffness: 260,
              damping: 20
            }}
          >
            <button
              onClick={card.action}
              className="suite-card w-full text-left p-10 group flex flex-col h-full focus:outline-none"
            >
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className={`p-5 rounded-[var(--radius-element)] bg-black/40 border border-[var(--color-outline)] shadow-lg group-hover:border-[var(--color-primary)] transition-colors ${card.color}`}>
                  <card.icon className="w-10 h-10" />
                </div>
                <ArrowRight className="w-8 h-8 opacity-40 group-hover:opacity-100 group-hover:text-[var(--color-primary)] transition-all -translate-x-4 group-hover:translate-x-0" />
              </div>

              <div className="relative z-10 flex-1">
                <h3 className="text-3xl font-black tracking-tighter mb-4 text-[var(--color-on-surface)] group-hover:text-[var(--color-primary)] transition-colors uppercase leading-none">
                  {card.title}
                </h3>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-40 leading-relaxed group-hover:opacity-60 transition-opacity">
                  {card.description}
                </p>
              </div>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default HomeView;
