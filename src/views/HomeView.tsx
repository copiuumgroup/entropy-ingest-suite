import React from 'react';
import { motion } from 'framer-motion';
import { Globe, Activity, Database, PlayCircle, ArrowRight } from 'lucide-react';
import type { ViewType } from '../components/SidebarRail';

interface HomeViewProps {
  onNavigate: (view: ViewType) => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const cards = [
    {
      id: 'yt-dlp',
      title: 'YT-DLP Downloader',
      description: 'Download the highest quality media straight into your local environment.',
      icon: Globe,
      color: 'text-blue-400',
      action: () => onNavigate('yt-dlp'),
      available: true
    },
    {
      id: 'vault',
      title: 'Local Vault',
      description: 'Your central library for managed, secure audio projects and offline assets.',
      icon: Database,
      color: 'text-purple-400',
      action: () => onNavigate('vault'),
      available: true
    },
    {
      id: 'studio',
      title: 'Audio Studio',
      description: 'Master and process audio locally using pristine WebGPU dynamics.',
      icon: Activity,
      color: 'text-emerald-400',
      action: () => onNavigate('studio'),
      available: true
    },
    {
      id: 'player',
      title: 'Media Player',
      description: 'Built-in high-fidelity player with live streaming DSP.',
      icon: PlayCircle,
      color: 'text-rose-400',
      action: () => onNavigate('player'),
      available: true
    }
  ];

  return (
    <div className="w-full h-full flex flex-col p-12 overflow-y-auto">
      {/* Header Area */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-16 mt-8"
      >
        <h1 className="text-5xl font-black tracking-tight mb-4 text-[var(--color-primary)]">
          Material Suite
        </h1>
        <p className="text-lg opacity-60 font-medium max-w-2xl text-[var(--color-on-surface)] leading-relaxed">
          The decentralized, offline-first production environment. Navigate to your desired workspace to begin mastering, downloading, or managing your assets.
        </p>
      </motion.div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-6xl">
        {cards.map((card, idx) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + idx * 0.1 }}
          >
            <button
              onClick={card.action}
              disabled={!card.available}
              className={`w-full text-left p-8 suite-glass-deep border border-[var(--color-outline)] rounded-[var(--radius-container)] group transition-all duration-300 flex flex-col h-full relative overflow-hidden focus:outline-none ${
                card.available ? 'hover:bg-[var(--color-primary)]/5 hover:border-[var(--color-primary)]/40 hover:-translate-y-1 hover:shadow-2xl' : 'opacity-40 cursor-not-allowed'
              }`}
            >
              {/* Subtle background glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className={`p-4 rounded-[var(--radius-element)] bg-[var(--color-surface)] border border-[var(--color-outline)] shadow-lg ${card.color}`}>
                  <card.icon className="w-8 h-8" />
                </div>
                {card.available && (
                  <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                )}
                {!card.available && (
                  <div className="suite-chip opacity-60">Soon</div>
                )}
              </div>

              <div className="relative z-10 flex-1">
                <h3 className="text-2xl font-bold tracking-tight mb-3 text-[var(--color-primary)]">
                  {card.title}
                </h3>
                <p className="text-[var(--color-on-surface)] opacity-70 leading-relaxed font-medium">
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
