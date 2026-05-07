import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Trash2, Settings } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  proxy: string;
  setProxy: (proxy: string) => void;
  engineSettings: { connections: number; splits: number; userAgent: string };
  setEngineSettings: (settings: { connections: number; splits: number; userAgent: string }) => void;
  showTelemetry: boolean;
  setShowTelemetry: (show: boolean) => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  proxy,
  setProxy,
  engineSettings,
  setEngineSettings,
  showTelemetry,
  setShowTelemetry
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="overflow-hidden flex flex-col w-full max-w-2xl max-h-[80vh] suite-glass-deep rounded-[var(--radius-container)] shadow-2xl"
          >
            {/* Header */}
            <div className="p-8 border-b border-[var(--color-outline)] flex items-center justify-between suite-glass-subtle">
              <div className="flex items-center gap-4">
                <Settings className="w-6 h-6 text-[var(--color-primary)] opacity-40" />
                <h2 className="text-2xl font-black uppercase tracking-tighter suite-glow-text leading-none">Settings</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-[var(--radius-element)] transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">

              {/* Interface Section */}
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
                  Interface Architecture
                </h3>

                <div className="space-y-4">
                  <div className="pt-2">
                    <SliderItem
                      label="Interface Scaling"
                      value={parseFloat(localStorage.getItem('ui-scale') || '1.0')}
                      min={0.5} max={1.5} step={0.25}
                      unit="x"
                      onChange={(v) => {
                        localStorage.setItem('ui-scale', v.toString());
                        if (window.electronAPI) window.electronAPI.setZoomFactor(v);
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-[var(--color-outline)]/40">
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">System Telemetry</p>
                      <p className="text-[8px] opacity-30 uppercase tracking-widest">Show CPU/RAM usage in sidebar</p>
                    </div>
                    <button
                      onClick={() => setShowTelemetry(!showTelemetry)}
                      className={`w-12 h-6 rounded-full transition-all relative ${showTelemetry ? 'bg-[var(--color-primary)]' : 'bg-black/40 border border-[var(--color-outline)]'}`}
                    >
                      <motion.div
                        animate={{ x: showTelemetry ? 24 : 4 }}
                        className={`absolute top-1 w-4 h-4 rounded-full ${showTelemetry ? 'bg-[var(--color-on-primary)]' : 'bg-white/20'}`}
                      />
                    </button>
                  </div>
                </div>
              </section>

              {/* Ingest Engine Section */}
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
                  Ingest Engine Velocity
                </h3>
                <div className="space-y-8 bg-white/5 p-8 border border-[var(--color-outline)] rounded-[var(--radius-container)]">
                  <div className="grid grid-cols-2 gap-8">
                    <SliderItem
                      label="Connections / Host"
                      value={engineSettings.connections}
                      min={1} max={32} step={1}
                      unit=""
                      onChange={(v) => setEngineSettings({ ...engineSettings, connections: v })}
                    />
                    <SliderItem
                      label="Splits / File"
                      value={engineSettings.splits}
                      min={1} max={32} step={1}
                      unit=""
                      onChange={(v) => setEngineSettings({ ...engineSettings, splits: v })}
                    />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-[var(--color-outline)]/40">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Engine Identity (User-Agent)</p>
                    <input
                      type="text"
                      value={engineSettings.userAgent}
                      onChange={(e) => setEngineSettings({ ...engineSettings, userAgent: e.target.value })}
                      placeholder="Mozilla/5.0..."
                      className="suite-input w-full p-4 !py-3 text-xs font-mono"
                    />
                  </div>
                </div>
              </section>

              {/* Regional Bypass Section */}
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
                  Regional Ingest Bypass
                </h3>
                <div className="space-y-4">
                  <div className="p-6 border border-[var(--color-outline)] bg-white/5 space-y-4 rounded-[var(--radius-container)]">
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-black uppercase">Global Proxy Node</p>
                      <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">Use this to bypass SoundCloud or YouTube region blocks.</p>
                    </div>
                    <input
                      type="text"
                      value={proxy}
                      onChange={(e) => setProxy(e.target.value)}
                      placeholder="http://user:pass@host:port or socks5://..."
                      className="suite-input w-full p-4 !py-3 text-xs font-mono"
                    />
                  </div>
                </div>
              </section>

              {/* Database Section */}
              <section className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">
                  Storage & Library Node
                </h3>
                <div className="flex gap-4">
                  <button
                    onClick={async () => {
                      if (window.electronAPI) await window.electronAPI.openAppDataFolder();
                    }}
                    className="flex-1 p-6 border border-[var(--color-outline)] bg-white/5 hover:bg-[var(--color-primary)]/5 transition-all text-left group rounded-[var(--radius-container)]"
                  >
                    <Folder className="w-6 h-6 mb-3 opacity-40 group-hover:opacity-100 transition-all" />
                    <p className="text-xs font-black uppercase">Open AppData</p>
                    <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Direct Windows Explorer Link</p>
                  </button>

                  <button
                    onClick={async () => {
                      if (window.electronAPI) {
                        const confirmed = confirm('DANGER: This will permanently delete your entire media database and all ingested file references. Continue?');
                        if (confirmed) await window.electronAPI.purgeArchives();
                      }
                    }}
                    className="flex-1 p-6 border border-[var(--color-outline)] bg-white/5 hover:bg-red-500/10 text-red-500 transition-all text-left group rounded-[var(--radius-container)]"
                  >
                    <Trash2 className="w-6 h-6 mb-3 opacity-40 group-hover:opacity-100 transition-all" />
                    <p className="text-xs font-black uppercase">Purge Library</p>
                    <p className="text-[9px] opacity-40 uppercase tracking-widest mt-1">Clear all ingested file metadata</p>
                  </button>
                </div>
              </section>

              {/* System Section */}
              <section className="space-y-4 pt-4 opacity-40 border-t border-[var(--color-outline)]">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span>Engine Standard</span>
                  <span>ENTROPY-HUB-V2</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span>Target OS</span>
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
