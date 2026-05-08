# 🔳 Entropy Ingest Suite (EIS)

A high-performance, local-first media environment for professional audio/video discovery and ingestion. Built with a monolithic OLED-optimized aesthetic and a high-velocity multi-threaded download engine.

---

## ✨ Features

- **High-Velocity Pipeline**: Multi-threaded downloads powered by `yt-dlp` and `aria2c` with built-in metadata resilience.
- **Unified Hub**: Search (YouTube & SoundCloud), prepare, and download in one persistent workflow.
- **Media Library**: Auto-import to local storage, seamless handoffs to VLC/MPV.
- **Monolith Aesthetics**: Hardware-accelerated blurs, Mica support on Windows 11, and infinite void contrast.

---

## 💻 Two Environments

Entropy Ingest Suite ships with two optimized frontends:

### 1. Entropy Studio (Electron/React)
The full visual desktop experience.
- **Stack**: Electron, React 19, Tailwind CSS v4, Dexie.js
- **Run**: `npm run dev`
- **Build**: `npm run package`

### 2. Entropy CLI (Go TUI)
A blazingly fast, highly-responsive keyboard-driven terminal interface.
- **Stack**: Go 1.23+, Bubble Tea, native yt-dlp orchestration
- **Run**: `npm run dev:cli` (or `cd entropy-cli && go run main.go`)
- **Build**: `cd entropy-cli && go build -o entropy.exe main.go`

---

## 🚀 Getting Started

### Prerequisites
- `Node.js` & `npm`
- `Go 1.23+` (if building the CLI)
- System Binaries: `yt-dlp`, `aria2`, `ffmpeg` (must be in system PATH)

### Installation
```bash
git clone https://github.com/copiuumgroup/entropy-ingest-suite.git
cd entropy-ingest-suite
npm install
```

---

*Intellectual property of **copiuum group**.*
