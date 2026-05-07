import { Activity, Globe, Settings, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { StudioGlow } from './common/StudioGlow';
import { cn } from '../utils';

declare const __BUILD_ID__: string;

export type ViewType = 'home' | 'vault' | 'yt-dlp';

interface Props {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onOpenSettings: () => void;
  hardwareMetrics?: { cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number } | null;
}

const SidebarRail: React.FC<Props> = ({ 
    currentView, 
    setView, 
    onOpenSettings,
    hardwareMetrics
}) => {
  const items = [
    { id: 'home' as ViewType, icon: Home, label: 'HUB' },
    { id: 'yt-dlp' as ViewType, icon: Globe, label: 'INGEST' },
    { id: 'vault' as ViewType, icon: Activity, label: 'FOLDER' },
  ];

  return (
    <div className="w-20 flex flex-col items-center py-10 gap-10 relative z-[60] bg-[var(--color-surface)] border-r border-[var(--color-outline)]">
      <div className="w-12 h-12 flex items-center justify-center mb-4 relative group border border-[var(--color-outline)] bg-[var(--color-primary)]/5 rounded-[var(--radius-element)] transition-all hover:border-[var(--color-primary)]/30">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <svg 
          width="24" height="24" 
          viewBox="0 0 32 32" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="text-[var(--color-primary)] transition-transform group-hover:scale-110 duration-500 relative z-10"
        >
          <path d="M0 4C0 1.79086 1.79086 0 4 0H28C30.2091 0 32 1.79086 32 4V28C32 30.2091 30.2091 32 28 32H4C1.79086 32 0 30.2091 0 28V4Z" fill="currentColor"/>
          <path d="M32 0L18 14" stroke="var(--color-surface)" strokeWidth="3.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <motion.button
              key={item.id}
              onClick={() => setView(item.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "group relative w-14 h-14 flex items-center justify-center rounded-[var(--radius-element)] transition-all duration-300 border-2",
                isActive 
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg border-transparent" 
                    : "border-transparent hover:border-[var(--color-on-surface)]/40 hover:bg-[var(--color-on-surface)]/5 opacity-40 hover:opacity-100 active:scale-90"
              )}
            >
              {isActive && <StudioGlow className="-z-10" size="sm" opacity={0.25} animate={true} />}
              <item.icon className={cn(
                  "w-6 h-6 transition-transform duration-300 relative z-10", 
                  isActive ? "scale-110" : "scale-100"
              )} />
              
              {/* Tooltip */}
              <motion.div 
                initial={{ opacity: 0, x: -10, scale: 0.9 }}
                whileHover={{ opacity: 1, x: 0, scale: 1 }}
                className="absolute left-20 px-4 py-2 text-[var(--color-on-surface)] text-[10px] font-black uppercase tracking-widest pointer-events-none transition-all whitespace-nowrap z-[100] suite-glass-subtle rounded-[var(--radius-element)] shadow-2xl border border-[var(--color-outline)] opacity-0 group-hover:opacity-100"
              >
                  {item.label}
              </motion.div>


            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        <button 
          onClick={onOpenSettings}
          className="w-14 h-14 flex items-center justify-center transition-all rounded-[var(--radius-element)] opacity-40 hover:opacity-100 hover:bg-[var(--color-primary)]/10"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Metrics Section */}
      {hardwareMetrics && (
        <div className="flex flex-col items-center gap-4 mb-2 opacity-30 group-hover:opacity-100 transition-opacity">
            <div className="flex flex-col items-center">
                <span className="text-[7px] font-black uppercase tracking-widest mb-0.5">CPU</span>
                <span className="text-[9px] font-mono font-black">{Math.round(hardwareMetrics.cpuPercent)}%</span>
            </div>
            <div className="w-4 h-px bg-[var(--color-outline)]" />
            <div className="flex flex-col items-center">
                <span className="text-[7px] font-black uppercase tracking-widest mb-0.5">RAM</span>
                <span className="text-[9px] font-mono font-black">{Math.round(hardwareMetrics.memoryWorkingSetMB)}<span className="text-[6px] ml-0.5">MB</span></span>
            </div>
        </div>
      )}

      {/* Build Versioning */}
      <div className="absolute bottom-4 select-none pointer-events-none">
        <span className="text-[7px] font-mono font-black tracking-[0.3em] opacity-20 vertical-text uppercase">Build {__BUILD_ID__}</span>
      </div>
    </div>
  );
};


export default SidebarRail;
