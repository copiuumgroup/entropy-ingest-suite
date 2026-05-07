# 🔳 Entropy Ingest Suite: Dev Vibe Guide

Welcome to the **Monolith Slab** toolchain. This guide covers how to run, debug, and package the suite into a standalone Windows `.exe`.

## 🛠️ The Dev Flow

### 1. Local Development
To run the app with hot-reloading (the fastest way to code):
```bash
npm run dev
```
- **Vite** serves the frontend.
- **Electron** spawns the main window and the **Python Studio Engine**.
- Any changes to `src/` will hot-reload instantly.

### 2. Generating a Portable `.exe`
When you're ready to share the suite or use it as a standalone tool:
```bash
npm run package
```
**What happens under the hood:**
1.  `npm run bump`: Generates a fresh build ID (e.g., `dev-pdh51`).
2.  `tsc`: Compiles TypeScript files.
3.  `vite build`: Bundles the React frontend into `dist/`.
4.  `electron-builder`: Packages everything into a single, portable executable in the `release/` folder.

## 📦 Where is my Build?
After running `npm run package`, check the **`release/`** directory.
You will find **`Entropy Ingest Suite.exe`**. This is a "Portable" build—no installation required. Just double-click and run.

## ⚠️ Important Dev Notes
-   **Native Binaries**: The `.exe` still depends on `yt-dlp.exe`, `ffmpeg.exe`, and `python` being available on the host system's PATH. For a truly "Monolithic" portable build in the future, we would bundle these inside the `assets/` folder.
-   **Python Environment**: Ensure your global Python has the requirements installed (`pip install -r python/requirements.txt`) so the Studio Engine doesn't crash in the built app.
-   **Mica/Acrylic**: If you are on Windows 11, the app will automatically use **Mica** material. On Windows 10, it falls back to **Acrylic**.

## 🔳 The "Slab" Philosophy
- **Stay Sharp**: Use the `suite-` CSS classes for consistent geometry.
- **Stay Snappy**: All UI transitions should feel mechanical and high-velocity.
- **OLED First**: Always verify your designs in Dark Mode—true black (`#000000`) is the baseline.

Happy Mastering! 🚀🔳
