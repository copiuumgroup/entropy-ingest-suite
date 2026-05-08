package ingest

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/copiuumgroup/entropy-cli/internal/config"
)

// Result holds metadata for a single track returned by search or URL fetch.
type Result struct {
	Title    string `json:"title"`
	Uploader string `json:"uploader"`
	URL      string `json:"webpage_url"`
	ID       string `json:"id"`
	Duration int    `json:"duration"`
}

// rawResult decodes both "webpage_url" (full metadata) and "url"
// (flat-playlist entries) so neither field is lost.
type rawResult struct {
	Title      string  `json:"title"`
	FullTitle  string  `json:"fulltitle"`
	DisplayID  string  `json:"display_id"`
	Uploader   string  `json:"uploader"`
	Artist     string  `json:"artist"`
	Channel    string  `json:"channel"`
	UploaderID string  `json:"uploader_id"`
	WebURL     string  `json:"webpage_url"`
	FlatURL    string  `json:"url"`
	ID         string  `json:"id"`
	Duration   float64 `json:"duration"`
}

func (r rawResult) toResult(fallback string) Result {
	u := r.WebURL
	if u == "" {
		u = r.FlatURL
	}
	if u == "" {
		u = fallback
	}
	up := r.Uploader
	if up == "" {
		up = r.Artist
	}
	if up == "" {
		up = r.Channel
	}
	if up == "" {
		up = r.UploaderID
	}
	if up == "" {
		up = "Unknown"
	}

	title := r.Title
	if title == "" {
		title = r.FullTitle
	}
	if title == "" {
		title = r.DisplayID
	}
	if title == "" {
		title = "Untitled"
	}

	return Result{
		Title:    title,
		Uploader: up,
		URL:      u,
		ID:       r.ID,
		Duration: int(r.Duration),
	}
}

// runYtDlp executes yt-dlp with the given arguments and returns its stdout.
// Unlike exec.Command.Output(), this does NOT fail on non-zero exit codes —
// yt-dlp often exits with code 1 while still emitting valid JSON to stdout
// (e.g. when it prints a warning alongside metadata).
func runYtDlp(args ...string) (string, error) {
	cmd := exec.Command("yt-dlp", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	_ = cmd.Run() // intentionally ignore exit code

	out := stdout.String()
	if strings.TrimSpace(out) == "" {
		// Nothing on stdout — use stderr as the error message
		errMsg := strings.TrimSpace(stderr.String())
		if errMsg == "" {
			errMsg = "yt-dlp produced no output"
		}
		// Trim long yt-dlp error traces to first line
		if nl := strings.Index(errMsg, "\n"); nl > 0 {
			errMsg = errMsg[:nl]
		}
		return "", fmt.Errorf("%s", errMsg)
	}
	return out, nil
}

// UpdateYtDlp runs `yt-dlp --update` and returns a short human-readable status
// string describing what happened (already up to date, updated to vX.Y.Z, etc.)
func UpdateYtDlp() (string, error) {
	cmd := exec.Command("yt-dlp", "--update")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	// yt-dlp writes update info to stdout; errors go to stderr
	combined := strings.TrimSpace(stdout.String() + "\n" + stderr.String())

	// Summarise to the most relevant single line
	for _, line := range strings.Split(combined, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// yt-dlp prints lines like:
		//   "yt-dlp is up to date (2025.01.26)"
		//   "Updated yt-dlp to 2025.01.26"
		//   "ERROR: ..."
		return line, nil
	}

	if err != nil {
		return "", fmt.Errorf("yt-dlp update failed: %w", err)
	}
	return "yt-dlp update completed", nil
}

// Search queries YouTube or SoundCloud via yt-dlp.
// Returns up to 20 results for YouTube and 10 for SoundCloud.
func Search(query string, provider string) ([]Result, error) {
	prefix := "ytsearch20:"
	if provider == "soundcloud" {
		prefix = "scsearch10:"
	}

	args := []string{
		"--dump-json",
		"--no-warnings",
	}
	args = append(args, fmt.Sprintf("%s%s", prefix, query))

	out, err := runYtDlp(args...)
	if err != nil {
		return nil, err
	}

	results := parseJSONLines(out, "")
	if len(results) == 0 {
		return nil, fmt.Errorf("no results returned — yt-dlp may need updating")
	}
	return results, nil
}

// FetchInfo retrieves metadata for a direct URL without doing a keyword search.
// It tries two strategies: flat-playlist (fast, good for playlists) then
// no-playlist (full metadata, better for single tracks).
func FetchInfo(url string) ([]Result, error) {
	url = strings.TrimSpace(url)

	baseArgs := []string{
		"--dump-json",
		"--no-warnings",
	}
	if archive := config.ArchivePath(); archive != "" {
		baseArgs = append(baseArgs, "--download-archive", archive)
	}

	// Strategy 1: flat-playlist — fast, handles playlists (no item limit)
	out, err := runYtDlp(append(baseArgs, "--flat-playlist", "--", url)...)

	// Strategy 2: no-playlist fallback
	if err != nil || strings.TrimSpace(out) == "" {
		out2, err2 := runYtDlp(append(baseArgs, "--no-playlist", "--", url)...)
		if err2 != nil {
			if err != nil {
				return nil, fmt.Errorf("could not fetch URL info: %w", err)
			}
			return nil, fmt.Errorf("could not fetch URL info: %w", err2)
		}
		out = out2
	}

	results := parseJSONLines(out, url)
	if len(results) == 0 {
		return nil, fmt.Errorf("yt-dlp found no tracks at that URL")
	}
	return results, nil
}

// parseJSONLines parses newline-delimited JSON output from yt-dlp.
// fallbackURL is used when a parsed entry has no url/webpage_url field.
func parseJSONLines(output string, fallbackURL string) []Result {
	var results []Result
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || !strings.HasPrefix(line, "{") {
			continue
		}
		var r rawResult
		if err := json.Unmarshal([]byte(line), &r); err != nil {
			continue
		}
		if r.Title == "" && r.FullTitle == "" && r.DisplayID == "" {
			continue
		}
		results = append(results, r.toResult(fallbackURL))
	}
	return results
}

// ──────────────────────────────────────────────────────────────────────────────
// Download
// ──────────────────────────────────────────────────────────────────────────────

// Progress represents the live state of a running download.
type Progress struct {
	Percent float64
	Speed   string
	Status  string
	Phase   string // "downloading" | "processing" | "done"
}

// DownloadOptions configures the ingest engine.
type DownloadOptions struct {
	Mode            string
	Quality         string
	Connections     int
	Splits          int
	UserAgent       string
	DestinationPath string
}

// Download starts a yt-dlp download and streams progress into progressChan.
func Download(url string, opt DownloadOptions, progressChan chan Progress) error {
	if opt.Connections == 0 {
		opt.Connections = 16
	}
	if opt.Splits == 0 {
		opt.Splits = 16
	}
	if opt.UserAgent == "" {
		opt.UserAgent = "Mozilla/5.0"
	}

	aria2Args := fmt.Sprintf("aria2c:-x %d -s %d -j %d -c --user-agent=%s",
		opt.Connections, opt.Splits, opt.Connections, opt.UserAgent)

	args := []string{
		"--newline",
		"--progress",
		"--progress-template", "downloading:%(progress._percent_str)s:%(progress._speed_str)s",
		"--no-playlist",
		"--downloader", "aria2c",
		"--downloader-args", aria2Args,
		"--user-agent", opt.UserAgent,
		"--embed-thumbnail",
		"--add-metadata",
		"--continue",
		"-o", fmt.Sprintf("%s/%%(uploader)s - %%(title)s.%%(ext)s", opt.DestinationPath),
	}

	if archive := config.ArchivePath(); archive != "" {
		args = append(args, "--download-archive", archive)
	}

	if opt.Mode == "audio" {
		args = append(args, "-x", "--audio-format", opt.Quality)
		if opt.Quality == "mp3" {
			args = append(args, "--audio-quality", "320K")
		}
	} else {
		args = append(args, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
	}

	args = append(args, "--", url)

	cmd := exec.Command("yt-dlp", args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	// Scan stderr concurrently for ffmpeg post-processing lines.
	// yt-dlp writes [ExtractAudio], [Metadata], [EmbedThumbnail] to stderr.
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		sc := bufio.NewScanner(stderr)
		for sc.Scan() {
			line := sc.Text()
			switch {
			case strings.Contains(line, "[ExtractAudio]"):
				progressChan <- Progress{Percent: 1.0, Status: "Converting to " + strings.ToUpper(opt.Quality) + "...", Phase: "processing"}
			case strings.Contains(line, "[Metadata]"):
				progressChan <- Progress{Percent: 1.0, Status: "Writing track info...", Phase: "processing"}
			case strings.Contains(line, "[EmbedThumbnail]"), strings.Contains(line, "[ThumbnailsConvertor]"):
				progressChan <- Progress{Percent: 1.0, Status: "Embedding album art...", Phase: "processing"}
			}
		}
	}()

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "downloading:"):
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				percentStr := strings.TrimSpace(strings.ReplaceAll(parts[1], "%", ""))
				var percent float64
				fmt.Sscanf(percentStr, "%f", &percent)
				progressChan <- Progress{
					Percent: percent / 100.0,
					Speed:   parts[2],
					Status:  fmt.Sprintf("Downloading  %.1f%%", percent),
					Phase:   "downloading",
				}
			}
		// Also catch post-processing from stdout (some yt-dlp versions)
		case strings.Contains(line, "[ExtractAudio]"):
			progressChan <- Progress{Percent: 1.0, Status: "Converting to " + strings.ToUpper(opt.Quality) + "...", Phase: "processing"}
		case strings.Contains(line, "[Metadata]"):
			progressChan <- Progress{Percent: 1.0, Status: "Writing track info...", Phase: "processing"}
		case strings.Contains(line, "[EmbedThumbnail]"), strings.Contains(line, "[ThumbnailsConvertor]"):
			progressChan <- Progress{Percent: 1.0, Status: "Embedding album art...", Phase: "processing"}
		}
	}

	err = cmd.Wait()
	wg.Wait() // ensure stderr goroutine finishes before we close
	close(progressChan)

	// If yt-dlp exited non-zero but a file was written, treat as success.
	// This prevents warnings about metadata or already-downloaded files from failing the TUI.
	if err != nil {
		if recentFileExists(opt.DestinationPath) {
			return nil
		}
	}

	return err
}

// recentFileExists checks if any file in the directory was modified in the last 30 seconds.
func recentFileExists(dir string) bool {
	files, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	now := time.Now()
	for _, f := range files {
		info, err := f.Info()
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) < 30*time.Second {
			return true
		}
	}
	return false
}
