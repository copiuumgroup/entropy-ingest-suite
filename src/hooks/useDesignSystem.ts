import { useEffect, useState } from 'react';

export function useDesignSystem() {
  const [accentColor, setAccentColor] = useState('#ffffff');

  useEffect(() => {
    async function initTheme() {
      if (window.electronAPI) {
        try {
          let accent = await window.electronAPI.getSystemAccent();
          
          // Robust Hex Normalization (Electron on Windows can return RRGGBBAA or RRGGBB)
          if (!accent.startsWith('#')) accent = `#${accent}`;
          if (accent.length === 9) accent = accent.substring(0, 7); // Strip Alpha if present
          
          setAccentColor(accent);
          
          // Convert Hex to RGB for Glow/Border variables
          let r = parseInt(accent.slice(1, 3), 16);
          let g = parseInt(accent.slice(3, 5), 16);
          let b = parseInt(accent.slice(5, 7), 16);
          
          // OLED Luminance Guard: Ensure color is bright enough to be seen on black
          // L = 0.2126*R + 0.7152*G + 0.0722*B (Standard Luminance)
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b);
          if (luminance < 120) {
              // Too dark! Force it to be more vibrant by scaling up components
              const factor = 120 / (luminance || 1); 
              r = Math.min(255, Math.round(r * factor + 50));
              g = Math.min(255, Math.round(g * factor + 50));
              b = Math.min(255, Math.round(b * factor + 50));
              
              // Re-encode to hex
              const toHex = (n: number) => n.toString(16).padStart(2, '0');
              accent = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
              console.warn(`[DESIGN] Accent was too dark (${Math.round(luminance)}). Brightened to: ${accent}`);
          }

          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            const rgbString = `${r}, ${g}, ${b}`;
            
            // Inject into CSS Variables
            document.documentElement.style.setProperty('--color-primary', accent);
            document.documentElement.style.setProperty('--color-primary-rgb', rgbString);
            
            console.log(`[DESIGN] System Accent Synced: ${accent} (${rgbString})`);
          }

          // Sync Title Bar
          window.electronAPI.updateTitleBarOverlay({
            color: '#00000000',
            symbolColor: '#ffffff'
          });
        } catch (e) {
          console.error('[DESIGN] Failed to sync system theme:', e);
        }
      }
    }

    initTheme();
    
    // Optional: Refresh on window focus to catch OS changes
    window.addEventListener('focus', initTheme);
    return () => window.removeEventListener('focus', initTheme);
  }, []);

  return { accentColor };
}
