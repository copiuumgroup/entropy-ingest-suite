# 🔳 Monolith Slab: Material Suite
**The Definitive Native-First Audio Mastering Studio by copiuum group.**

Material Suite is a high-performance, local-first audio environment designed exclusively for professional Windows mastering. It combines modern Material Design 3 aesthetics with the **Monolith Slab** identity—a sharp, high-contrast design system optimized for absolute focus and performance.

---

## 🤖 Artificial Intelligence Warning
**This project was built with significant assistance from advanced AI agents (copiuum group).** 
While the codebase is hardened and production-ready, it utilizes highly specialized, native-first architecture that prioritizes AI-driven design patterns and direct system integration.

## ⚠️ Platform & Compatibility
Material Suite is **Strictly Windows-Only**. Cross-platform support is currently not a project goal.
For maximum stability, performance, and UI fidelity, we advise running the suite on:
-   **Windows 10/11 IoT Enterprise LTSC** (Recommended for absolute stability)
-   **Windows 11 22H2+ Pro/Enterprise**

*The app utilizes native Windows 11 Mica material and Title Bar Overlays. Transparency is handled via the native DWM (Desktop Window Manager) to ensure 100% reliability for Windows Snap Layouts and local hardware acceleration.*

---

## ✨ Key Features

### 🔳 Monolith Slab Design System
- **Absolute Contrast**: A forced high-contrast system ensuring 100% readability across OLED Dark and Studio Light modes.
- **Minimalist Geometry**: Sharp corners, cubic-bezier (snappy) animations, and custom geometric "Slab" iconography.
- **Dynamic Starfield**: A hardware-accelerated particle system that reacts to mouse movement and theme shifts.

### 🎛️ Unified Studio Workspace
- **Consolidated Architecture**: The Studio and Vault have been merged into a single, high-velocity interface for seamless mastering and project management.
- **3-Way Multi-Band Compressor**: A high-fidelity crossover matrix for surgical dynamic control.
- **Auto-EQ (Algorithmic)**: Analyzes track frequency response and suggests corrective curves.
- **Slowed + Reverb & Nightcore**: Professional resamplers and IR-convolution engines for aesthetic audio manipulation.

### 📥 yt-dlp Engine (Native discovery)
- **Global Search**: Search terms directly on YouTube and SoundCloud without leaving the app.
- **Batch Link Importer**: Directly ingest entire playlists, albums, or multiple URLs into a staging area.
- **Download Queue**: A dedicated local production queue for managing high-quality 320kbps audio imports.

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js / npm** (Current build pipeline)
-   **yt-dlp** (Must be in your system PATH)
-   **ffmpeg** (Required for high-fidelity audio extraction)
-   **Windows IoT Enterprise LTSC** (Highly Recommended)

### Installation
```bash
# Clone the repository
git clone https://github.com/copiuumgroup/material-suite.git

# Install dependencies
npm install

# Run in Development Mode
npm run dev
```

### Building for Production
```bash
# Generate a portable standalone .exe
npm run package
```

---

## 🛠️ Technology Stack
- **Core**: Electron, React 19, TypeScript 6.0, Vite 8
- **DSP**: Web Audio API (AudioContext & 32-bit Float Offline Rendering)
- **Video**: FFmpeg WebAssembly (v0.12+)
- **Styling**: Vanilla CSS (Tailwind CSS v4 Fallback), Framer Motion (Cubic Bézier velocity)
- **Discovery**: Native `yt-dlp` Process Management & Metadata Extraction
- **Storage**: Dexie.js (IndexedDB) with native FS-Metadata caching
- **Branding**: Proprietary Monolith Slab SVG Identity System

---

**Material Suite** is the intellectual property of **copiuum group**, a collective of multiple individuals behind the name. All rights reserved. 🚀🔳
