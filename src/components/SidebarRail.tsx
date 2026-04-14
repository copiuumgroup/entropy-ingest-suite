import React from 'react';
import { Database, Activity, Globe, Settings, Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

declare const __BUILD_ID__: string;

export type ViewType = 'vault' | 'studio' | 'transmission';

interface Props {
  currentView: ViewType;
  setView: (view: ViewType) => void;
  onOpenAppData: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const SidebarRail: React.FC<Props> = ({ currentView, setView, onOpenAppData, theme, setTheme }) => {
  const items = [
    { id: 'vault' as ViewType, icon: Database, label: 'Vault' },
    { id: 'studio' as ViewType, icon: Activity, label: 'Studio' },
    { id: 'transmission' as ViewType, icon: Globe, label: 'Transmission' },
  ];

  return (
    <div className="w-20 m3-glass-deep border-r border-[var(--color-outline)] flex flex-col items-center py-10 gap-10 relative z-[60]">
    <div className="w-12 h-12 bg-[var(--color-primary)]/10 rounded-2xl flex items-center justify-center border border-[var(--color-outline)] mb-4 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <img src="/icon.png" className="w-8 h-8 object-contain opacity-80 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 select-none" alt="Material Suite Logo" />
    </div>

      <div className="flex-1 flex flex-col gap-6">
        {items.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "group relative w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                isActive ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "hover:bg-[var(--color-primary)]/10 opacity-40 hover:opacity-100"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive ? "scale-110" : "scale-100")} />
              
              {/* Tooltip */}
              <div className="absolute left-20 px-4 py-2 m3-glass-subtle text-[var(--color-on-surface)] text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all shadow-2xl border border-[var(--color-outline)] whitespace-nowrap z-[100]">
                  {item.label}
              </div>

              {isActive && (
                <motion.div 
                    layoutId="active-indicator"
                    className="absolute -left-1 w-1 h-8 bg-[var(--color-primary)] rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-primary)]/10 opacity-40 hover:opacity-100 transition-all"
        >
          {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button 
          onClick={onOpenAppData}
          className="w-14 h-14 rounded-2xl flex items-center justify-center hover:bg-[var(--color-primary)]/10 opacity-40 hover:opacity-100 transition-all"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      {/* Build Versioning */}
      <div className="absolute bottom-4 select-none pointer-events-none">
        <span className="text-[7px] font-black tracking-[0.3em] opacity-10 vertical-text uppercase">Build {__BUILD_ID__}</span>
      </div>
    </div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default SidebarRail;
