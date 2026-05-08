package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// C is the loaded application configuration. Call Load() once at startup.
var C Config

// Config holds all user-tunable settings for entropy-cli.
type Config struct {
	// OutputDir is where downloaded files are saved.
	// Defaults to ~/Music on all platforms.
	OutputDir string

	// Quality is the audio format passed to yt-dlp -x --audio-format.
	// Supported: "mp3", "flac", "opus", "m4a"
	Quality string

	// Connections is the number of aria2c parallel connections (-x and -s).
	Connections int

	// Splits is the number of aria2c file splits (-s).
	Splits int

	// UserAgent is the HTTP user-agent string forwarded to yt-dlp and aria2c.
	UserAgent string

	// Provider is the default search provider: "youtube" or "soundcloud".
	Provider string

	// MaxConcurrent is the max number of simultaneous downloads.
	// Downloads beyond this limit are queued and start automatically as slots open.
	MaxConcurrent int
}

// defaults returns a Config pre-filled with sensible values.
func defaults() Config {
	home, _ := os.UserHomeDir()
	return Config{
		OutputDir:     filepath.Join(home, "Music"),
		Quality:       "mp3",
		Connections:   16,
		Splits:        16,
		UserAgent:     "Mozilla/5.0",
		Provider:      "youtube",
		MaxConcurrent: 3,
	}
}

// configDir returns the XDG-compliant config directory for entropy-cli.
func configDir() string {
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		return filepath.Join(xdg, "entropy-cli")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "entropy-cli")
}

// ConfigPath returns the absolute path to the config file.
func ConfigPath() string {
	return filepath.Join(configDir(), "config.toml")
}

// ArchivePath returns the path to the yt-dlp download archive file.
func ArchivePath() string {
	return filepath.Join(configDir(), "archive.txt")
}

// Load reads the config file from disk. If the file does not exist it is
// created with default values. Malformed lines are silently skipped.
func Load() error {
	C = defaults()

	path := ConfigPath()
	if err := os.MkdirAll(configDir(), 0755); err != nil {
		return fmt.Errorf("config: cannot create config dir: %w", err)
	}

	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return Save() // write defaults on first run
	}
	if err != nil {
		return fmt.Errorf("config: cannot open %s: %w", path, err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Strip inline comments
		if idx := strings.Index(val, " #"); idx >= 0 {
			val = strings.TrimSpace(val[:idx])
		}
		// Strip surrounding quotes
		val = strings.Trim(val, `"'`)

		switch key {
		case "output_dir":
			if val != "" {
				C.OutputDir = val
			}
		case "quality":
			if val != "" {
				C.Quality = val
			}
		case "connections":
			if n, err := strconv.Atoi(val); err == nil && n > 0 {
				C.Connections = n
			}
		case "splits":
			if n, err := strconv.Atoi(val); err == nil && n > 0 {
				C.Splits = n
			}
		case "user_agent":
			if val != "" {
				C.UserAgent = val
			}
		case "provider":
			if val == "youtube" || val == "soundcloud" {
				C.Provider = val
			}
		case "max_concurrent":
			if n, err := strconv.Atoi(val); err == nil && n > 0 {
				C.MaxConcurrent = n
			}
		}
	}
	return scanner.Err()
}

// Save writes the current Config back to disk.
func Save() error {
	path := ConfigPath()
	if err := os.MkdirAll(configDir(), 0755); err != nil {
		return err
	}

	content := fmt.Sprintf(`# entropy-cli configuration
# https://github.com/copiuumgroup/entropy-cli

[ingest]
output_dir     = %q  # where downloaded files are saved
quality        = %q  # mp3 | flac | opus | m4a
connections    = %d   # aria2c parallel connections
splits         = %d   # aria2c file splits
user_agent     = %q
max_concurrent = %d   # max simultaneous downloads (rest are queued)

[search]
provider = %q  # youtube | soundcloud
`,
		C.OutputDir,
		C.Quality,
		C.Connections,
		C.Splits,
		C.UserAgent,
		C.MaxConcurrent,
		C.Provider,
	)

	return os.WriteFile(path, []byte(content), 0644)
}

// EnsureOutputDir creates the output directory if it does not exist.
func EnsureOutputDir() error {
	return os.MkdirAll(C.OutputDir, 0755)
}
