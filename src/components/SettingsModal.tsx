import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Moon, Sun, Folder, Trash2, Settings } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  limiter: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  setLimiter: (settings: { threshold: number; ratio: number; attack: number; release: number }) => void;
  proxy: string;
  setProxy: (proxy: string) => void;
}

export const SettingsModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  theme, 
  setTheme, 
  limiter,
  setLimiter,
  proxy,
  setProxy
}) => {
  const updateLimiter = (key: string, val: number) => {
    setLimiter({ ...limiter, [key]: val });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="overflow-hidden flex flex-col border border-[var(--color-outline)] w-full max-w-2xl max-h-[80vh] suite-glass-deep rounded-[var(--radius-container)] shadow-2xl"
          >
            {/* Header */}
            <div className="p-8 border-b border-[var(--color-outline)] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Settings className="w-6 h-6 opacity-40" />
                <h2 className="text-2xl font-black uppercase tracking-tighter">Central Settings</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-[var(--color-primary)]/10 rounded-[var(--radius-element)] transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
              
              {/* Appearance Section */}
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 flex items-center gap-2">
                   Visual Architecture
                </h3>
                
                <div className="space-y-4">
                  <SettingItem 
                    label="Surface Architecture" 
                    description="Toggle between monolithic OLED Black and Midnight Slate with subtle gradients."
                  >
                    <button 
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="flex items-center gap-3 px-6 py-2 border border-[var(--color-outline)] font-bold text-[10px] uppercase transition-all rounded-[var(--radius-element)] hover:bg-white/5 active:scale-95"
                    >
                      {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {theme === 'light' ? "Midnight" : "OLED"}
                    </button>
                  </SettingItem>
                </div>
              </section>

              {/* Advanced DSP Section */}
              <section className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 flex items-center gap-2">
                   Advanced DSP Mastering Node
                </h3>
                
                <div className="space-y-8 bg-[var(--color-surface)]/20 p-8 border border-[var(--color-outline)]">
                  <SliderItem 
                    label="Limiter Threshold" 
                    value={limiter.threshold} 
                    min={-20} max={0} step={0.5} 
                    unit="dB"
                    onChange={(v) => updateLimiter('threshold', v)} 
                  />
                  <SliderItem 
                    label="Compression Ratio" 
                    value={limiter.ratio} 
                    min={1} max={24} step={1} 
                    unit=":1"
                    onChange={(v) => updateLimiter('ratio', v)} 
                  />
                  <div className="grid grid-cols-2 gap-8">
                    <SliderItem 
                        label="Attack" 
                        value={limiter.attack} 
                        min={0.001} max={0.05} step={0.001} 
                        unit="s"
                        onChange={(v) => updateLimiter('attack', v)} 
                    />
                    <SliderItem 
                        label="Release" 
                        value={limiter.release} 
                        min={0.05} max={0.5} step={0.01} 
                        unit="s"
                        onChange={(v) => updateLimiter('release', v)} 
                    />
                  </div>
                </div>
              </section>

              {/* Regional Bypass Section */}
              <section className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 flex items-center gap-2">
                    Regional Ingest Bypass
                 </h3>
                 <div className="space-y-4">
                    <div className="p-6 border border-[var(--color-outline)] bg-[var(--color-surface)]/20 space-y-4 rounded-[var(--radius-container)]">
                        <div className="flex flex-col gap-1">
                            <p className="text-xs font-black uppercase">Global Proxy Node</p>
                            <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">Use this to bypass SoundCloud or YouTube region blocks (e.g. Latvia).</p>
                        </div>
                        <input 
                            type="text"
                            value={proxy}
                            onChange={(e) => setProxy(e.target.value)}
                            placeholder="http://user:pass@host:port or socks5://..."
                            className="w-full bg-black/40 border border-[var(--color-outline)] p-4 rounded-[var(--radius-element)] text-xs font-mono focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                        <div className="flex items-start gap-2 opacity-30 group">
                            <div className="w-1 h-1 rounded-full bg-[var(--color-primary)] mt-1.5" />
                            <p className="text-[8px] uppercase tracking-widest font-bold leading-relaxed">
                                Security Note: Proxy credentials are masked via Environment Variables. 
                                However, the proxy provider can still see your traffic. Use trusted nodes.
                            </p>
                        </div>
                    </div>
                 </div>
              </section>

              {/* Database Section */}
              <section className="space-y-6">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 flex items-center gap-2">
                   Storage & Vault Node
                </h3>
                <div className="flex gap-4">
                  <button 
                    onClick={async () => {
                        if (window.electronAPI) await window.electronAPI.openAppDataFolder();
                    }}
                    className="flex-1 p-6 border border-[var(--color-outline)] hover:bg-[var(--color-primary)]/5 transition-all text-left group rounded-[var(--radius-container)]"
                  >
                     <Folder className="w-6 h-6 mb-3 opacity-40 group-hover:opacity-100 transition-all" />
                     <p className="text-xs font-black uppercase">Open AppData</p>
                     <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Direct Windows Explorer Link</p>
                  </button>
                  
                  <button 
                    className="flex-1 p-6 border border-[var(--color-outline)] hover:bg-red-500/10 text-red-500 transition-all text-left group rounded-[var(--radius-container)]"
                  >
                     <Trash2 className="w-6 h-6 mb-3 opacity-40 group-hover:opacity-100 transition-all" />
                     <p className="text-xs font-black uppercase">Purge Impulse Vault</p>
                     <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Clear custom .wav reverb profiles</p>
                  </button>
                </div>
              </section>

              {/* System Section */}
              <section className="space-y-4 pt-4 opacity-40 border-t border-[var(--color-outline)]">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>Engine Standard</span>
                    <span>WAP-STUDIO-V8</span>
                 </div>
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span>Target Target</span>
                    <span>Windows 11 (NT 10.0)</span>
                 </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const SettingItem: React.FC<{ label: string; description: string; children: React.ReactNode }> = ({ label, description, children }) => (
  <div className="flex items-center justify-between gap-8 py-2">
    <div className="flex-1">
      <p className="text-xs font-black uppercase tracking-tight">{label}</p>
      <p className="text-[10px] opacity-40 uppercase tracking-widest mt-1 font-bold leading-relaxed max-w-sm">{description}</p>
    </div>
    {children}
  </div>
);

const SliderItem: React.FC<{ label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-end">
        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-xs font-bold text-[var(--color-primary)]">{value}{unit}</p>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-[var(--color-outline)] appearance-none cursor-pointer outline-none accent-[var(--color-primary)]"
    />
  </div>
);

