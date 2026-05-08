package ingest

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
)

type Result struct {
	Title    string `json:"title"`
	Uploader string `json:"uploader"`
	URL      string `json:"webpage_url"`
	ID       string `json:"id"`
}

// Search queries YouTube/SoundCloud using yt-dlp
func Search(query string, provider string) ([]Result, error) {
	prefix := "ytsearch5:"
	if provider == "soundcloud" {
		prefix = "scsearch5:"
	}

	args := []string{
		"--dump-json",
		"--no-warnings",
		fmt.Sprintf("%s%s", prefix, query),
	}

	cmd := exec.Command("yt-dlp", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp search failed: %w", err)
	}

	var results []Result
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var r Result
		if err := json.Unmarshal([]byte(line), &r); err == nil {
			results = append(results, r)
		}
	}

	return results, nil
}

// Progress represents the state of a download
type Progress struct {
	Percent float64
	Speed   string
	Status  string
}

// DownloadOptions represents configuration for the ingest engine
type DownloadOptions struct {
	Mode            string
	Quality         string
	Connections     int
	Splits          int
	UserAgent       string
	DestinationPath string
}

// Download starts a yt-dlp download with advanced options mirroring the Electron backend
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

	aria2Args := fmt.Sprintf("aria2c:-x %d -s %d -j %d -c --user-agent=\"%s\"", 
		opt.Connections, opt.Splits, opt.Connections, opt.UserAgent)

	args := []string{
		"--newline",
		"--progress",
		"--progress-template", "downloading:%(progress._percent_str)s:%(progress._speed_str)s",
		"--downloader", "aria2c",
		"--downloader-args", aria2Args,
		"--user-agent", opt.UserAgent,
		"--embed-thumbnail",
		"--add-metadata",
		"-o", fmt.Sprintf("%s/%%(uploader)s - %%(title)s.%%(ext)s", opt.DestinationPath),
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

	if err := cmd.Start(); err != nil {
		return err
	}

	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		
		if strings.HasPrefix(line, "downloading:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				percentStr := strings.TrimSpace(strings.ReplaceAll(parts[1], "%", ""))
				var percent float64
				fmt.Sscanf(percentStr, "%f", &percent)
				
				progressChan <- Progress{
					Percent: percent / 100.0,
					Speed:   parts[2],
					Status:  "Downloading",
				}
			}
		} else if strings.Contains(line, "[ExtractAudio]") {
			progressChan <- Progress{
				Percent: 1.0,
				Speed:   "Processing",
				Status:  "Extracting Audio (MP3)...",
			}
		} else if strings.Contains(line, "[Metadata]") {
			progressChan <- Progress{
				Percent: 1.0,
				Speed:   "Processing",
				Status:  "Embedding Metadata...",
			}
		} else if strings.Contains(line, "[ThumbnailsConvertor]") {
			progressChan <- Progress{
				Percent: 1.0,
				Speed:   "Processing",
				Status:  "Embedding Artwork...",
			}
		}
	}

	return cmd.Wait()
}

