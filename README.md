# 🔳 Entropy Ingest Suite: Dev Vibe Guide
**🔳 Entropy Ingest Suite (EIS)**

Entropy Ingest Suite is a high-performance, local-first media environment designed for professional media discovery and ingestion. It combines modern monolithic aesthetics with a high-velocity multi-threaded ingest pipeline.

---

## 🤖 Artificial Intelligence Warning
**This project was built with significant assistance from advanced AI agents (copiuum group).** 
While the codebase is hardened and production-ready, it utilizes highly specialized, native-first architecture that prioritizes AI-driven design patterns and direct system integration.

## ⚠️ Platform & Compatibility
Material Suite is **Cross-Platform** (Windows & Linux).
For maximum stability, performance, and UI fidelity, we advise:
-   **Windows**: Windows 11 22H2+ Pro/Enterprise (supports Mica & Title Bar Overlay)
-   **Linux**: Arch Linux / Fedora with a compositor (AppImage provided)

*The app utilizes hardware-accelerated glassmorphism and real-time binary process management. Performance is optimized for OLED displays and high-refresh environments.*

---

## ✨ Key Features

### 🔳 Monolith Slab Design System
- **Infinite Void Aesthetics**: A forced pure-black OLED contrast system ensuring 100% readability.
- **Glassmorphism 2.0**: High-fidelity backdrop blurs and monolithic geometry.
- **Universal Typography**: Integrated 'Outfit' and 'JetBrains Mono' for consistent professional appearance across all operating systems.

### 📥 High-Velocity Ingest Pipeline
- **Unified Hub**: Search, Prepare, and Download within a single persistent environment.
- **Preparation Bay**: Review search results from YouTube and SoundCloud before committing to the queue.
- **Multi-Threaded Engine**: Powered by `yt-dlp` and `aria2c` for maximum bandwidth utilization.
- **Direct Engage**: Automatically detects direct file links and routes them through the high-speed aria2 core.

### 📁 Media Library (Local Archive)
- **Auto-Import**: Successfully ingested media is automatically registered in your local database.
- **Instant Handoff**: Open files directly in VLC, MPV, or reveal them in your system explorer.
- **Persistent State**: Full queue and preparation history managed via Dexie.js (IndexedDB).

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js / npm** (Current build pipeline)
-   **yt-dlp** (Must be in your system PATH)
-   **aria2** (Required for multi-threaded direct downloads)
-   **ffmpeg** (Required for high-fidelity audio/video muxing)

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
# Generate a portable standalone build (.exe on Windows, .AppImage on Linux)
npm run package
```

---

## 🛠️ Technology Stack
- **Core**: Electron 41, React 19, TypeScript 6.0, Vite 8
- **Styling**: Tailwind CSS v4 (Pure CSS Configuration), Framer Motion (Snappy velocity)
- **Database**: Dexie.js (IndexedDB)
- **Discovery**: Native `yt-dlp` and `aria2c` process orchestration
- **Icons**: Lucide React (High-fidelity SVGs)

---

**Material Suite** is the intellectual property of **copiuum group**, a collective of multiple individuals behind the name. All rights reserved. 🚀🔳
