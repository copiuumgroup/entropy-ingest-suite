package main

import (
	"flag"
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/copiuumgroup/entropy-cli/internal/config"
	"github.com/copiuumgroup/entropy-cli/internal/ingest"
	"github.com/copiuumgroup/entropy-cli/tui"
)

func main() {
	// ── Flags ──────────────────────────────────────────────────────────────
	urlFlag := flag.String("url", "", "Download a single URL without launching the TUI")
	fileFlag := flag.String("file", "", "Batch download from a text file (one URL per line)")
	searchFlag := flag.String("search", "", "Search and print results as JSON (no TUI)")
	flag.Parse()

	// ── Config ─────────────────────────────────────────────────────────────
	if err := config.Load(); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not load config: %v\n", err)
	}
	if err := config.EnsureOutputDir(); err != nil {
		fmt.Fprintf(os.Stderr, "warning: could not create output dir %q: %v\n", config.C.OutputDir, err)
	}

	// ── Headless modes ─────────────────────────────────────────────────────
	switch {
	case *urlFlag != "":
		runHeadlessURL(*urlFlag)
		return
	case *fileFlag != "":
		runHeadlessFile(*fileFlag)
		return
	case *searchFlag != "":
		runHeadlessSearch(*searchFlag)
		return
	}

	// ── TUI mode ───────────────────────────────────────────────────────────
	p := tea.NewProgram(
		tui.NewRootModel(),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)
	if _, err := p.Run(); err != nil {
		fmt.Printf("error: %v\n", err)
		os.Exit(1)
	}
}

// runHeadlessURL downloads a single URL to stdout progress.
func runHeadlessURL(url string) {
	fmt.Printf("[entropy-cli] Fetching info for: %s\n", url)
	results, err := ingest.FetchInfo(url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[entropy-cli] Queuing %d track(s)\n", len(results))
	for _, r := range results {
		fmt.Printf("  → %s — %s\n", r.Uploader, r.Title)
		ch := make(chan ingest.Progress)
		go func() {
			for p := range ch {
				fmt.Printf("\r  %s", p.Status)
				if p.Speed != "" {
					fmt.Printf("  %s", p.Speed)
				}
			}
			fmt.Println()
		}()
		opts := ingest.DownloadOptions{
			Mode:            "audio",
			Quality:         config.C.Quality,
			Connections:     config.C.Connections,
			Splits:          config.C.Splits,
			UserAgent:       config.C.UserAgent,
			DestinationPath: config.C.OutputDir,
		}
		if err := ingest.Download(r.URL, opts, ch); err != nil {
			fmt.Fprintf(os.Stderr, "\nerror: %v\n", err)
		}
	}
}

// runHeadlessFile reads a URL list file and downloads each entry.
func runHeadlessFile(path string) {
	urls, err := ingest.ReadURLFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error reading file: %v\n", err)
		os.Exit(1)
	}
	if len(urls) == 0 {
		fmt.Fprintln(os.Stderr, "error: no URLs found in file")
		os.Exit(1)
	}
	fmt.Printf("[entropy-cli] %d URL(s) loaded from %s\n", len(urls), path)
	for i, u := range urls {
		fmt.Printf("[%d/%d] %s\n", i+1, len(urls), u)
		ch := make(chan ingest.Progress)
		go func() {
			for p := range ch {
				fmt.Printf("\r  %s", p.Status)
				if p.Speed != "" {
					fmt.Printf("  %s", p.Speed)
				}
			}
			fmt.Println()
		}()
		opts := ingest.DownloadOptions{
			Mode:            "audio",
			Quality:         config.C.Quality,
			Connections:     config.C.Connections,
			Splits:          config.C.Splits,
			UserAgent:       config.C.UserAgent,
			DestinationPath: config.C.OutputDir,
		}
		if err := ingest.Download(u, opts, ch); err != nil {
			fmt.Fprintf(os.Stderr, "\nerror: %v\n", err)
		}
	}
}

// runHeadlessSearch prints search results as plain text.
func runHeadlessSearch(query string) {
	results, err := ingest.Search(query, config.C.Provider)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
	for i, r := range results {
		dur := ""
		if r.Duration > 0 {
			dur = fmt.Sprintf(" [%d:%02d]", r.Duration/60, r.Duration%60)
		}
		fmt.Printf("%d. %s — %s%s\n   %s\n", i+1, r.Uploader, r.Title, dur, r.URL)
	}
}

