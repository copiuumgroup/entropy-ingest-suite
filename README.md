# Entropy CLI

A high-performance, standalone media ingest engine and TUI for YouTube and SoundCloud.

Entropy CLI is designed for speed, reliability, and ease of use. It replaces the original Electron-based suite with a native Go implementation, offering a robust terminal-based workflow for downloading and managing your music library.

## Features

- **Blazing Fast Ingestion**: Powered by `yt-dlp` and `aria2c` for maximum speed.
- **TUI Interface**: Beautiful, responsive terminal user interface built with `Bubble Tea`.
- **Batch Processing**: Import URLs from text files or paste multi-line lists from the clipboard.
- **Concurrent Limits**: Intelligent queue management to prevent system thrashing.
- **Library Management**: View and sort your library with native ID3 tag reading.
- **Headless Mode**: Full support for CLI flags for scripting and automation.

## Prerequisites

Ensure the following tools are in your system `PATH`:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [aria2c](https://aria2.github.io/)
- [ffmpeg](https://ffmpeg.org/)

## Installation

```bash
# Clone the repository
git clone https://github.com/copiuumgroup/entropy-cli
cd entropy-cli

# Build the binary
go build -o entropy
```

## Usage

### TUI Mode
Simply run the binary to launch the interactive interface:
```bash
./entropy
```

### Headless Mode
```bash
./entropy -url "https://www.youtube.com/watch?v=..."
./entropy -file urls.txt
./entropy -search "lofi hip hop"
```

## Configuration

Settings are stored in `~/.config/entropy-cli/config.toml`. You can configure:
- `output_dir`: Where files are saved.
- `quality`: Audio format (mp3, flac, opus, m4a).
- `max_concurrent`: Number of simultaneous downloads.
- `connections`: Aria2c parallel connections.

## License

MIT
