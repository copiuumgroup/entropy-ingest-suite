package tui

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/copiuumgroup/entropy-cli/internal/config"
	"github.com/copiuumgroup/entropy-cli/internal/ingest"
)

type Download struct {
	ID           int
	URL          string
	Title        string
	Progress     progress.Model
	Spinner      spinner.Model
	Speed        string
	Status       string
	Phase        string // "waiting", "downloading", "processing", "done", "error", "cancelled"
	ProgressChan chan ingest.Progress
	Cancel       context.CancelFunc // cancels the running download goroutine
}

type ForgeModel struct {
	Downloads []Download
	Width     int
	Cursor    int // selected item index for navigation
	Keys      ForgeKeyMap
}

func NewForgeModel() ForgeModel {
	return ForgeModel{
		Downloads: []Download{},
		Keys:      ForgeKeys(),
	}
}

func (m ForgeModel) Init() tea.Cmd {
	return nil
}

func (m ForgeModel) Update(msg tea.Msg) (ForgeModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		for i := range m.Downloads {
			m.Downloads[i].Progress.Width = msg.Width - 24
		}

	case tea.MouseMsg:
		// Mouse events forwarded (no-op for now but keeps message bus clean)

	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.Cursor > 0 {
				m.Cursor--
			}
		case "down", "j":
			if m.Cursor < len(m.Downloads)-1 {
				m.Cursor++
			}
		case "x", "delete":
			// Cancel the selected download if it's active or waiting
			if m.Cursor >= 0 && m.Cursor < len(m.Downloads) {
				d := &m.Downloads[m.Cursor]
				if d.Phase == "downloading" || d.Phase == "processing" || d.Phase == "waiting" {
					if d.Cancel != nil {
						d.Cancel()
					}
					d.Phase = "cancelled"
					d.Status = "Cancelled"
					// When something is cancelled, we might have a free slot
					cmds = append(cmds, m.checkNextDownload())
				}
			}
		case "r":
			// Retry the selected download if it failed or was cancelled
			if m.Cursor >= 0 && m.Cursor < len(m.Downloads) {
				d := &m.Downloads[m.Cursor]
				if d.Phase == "error" || d.Phase == "cancelled" {
					d.Phase = "waiting"
					d.Status = "Queued..."
					d.Progress.SetPercent(0)
					cmds = append(cmds, m.checkNextDownload())
				}
			}
		}

	case spinner.TickMsg:
		for i := range m.Downloads {
			if m.Downloads[i].Phase == "downloading" || m.Downloads[i].Phase == "processing" {
				newSp, cmd := m.Downloads[i].Spinner.Update(msg)
				m.Downloads[i].Spinner = newSp
				cmds = append(cmds, cmd)
			}
		}

	case progress.FrameMsg:
		for i := range m.Downloads {
			progressModel, cmd := m.Downloads[i].Progress.Update(msg)
			m.Downloads[i].Progress = progressModel.(progress.Model)
			cmds = append(cmds, cmd)
		}

	case DownloadProgressMsg:
		for i := range m.Downloads {
			if m.Downloads[i].ID == msg.ID {
				m.Downloads[i].Status = msg.Status
				m.Downloads[i].Speed = msg.Speed
				m.Downloads[i].Phase = msg.Phase
				cmds = append(cmds, m.Downloads[i].Progress.SetPercent(msg.Percent))
				cmds = append(cmds, WaitForProgressCmd(msg.ID, m.Downloads[i].ProgressChan))
			}
		}

	case DownloadDoneMsg:
		for i := range m.Downloads {
			if m.Downloads[i].ID == int(msg) {
				outDir := config.C.OutputDir
				m.Downloads[i].Status = fmt.Sprintf("Saved to %s", outDir)
				m.Downloads[i].Speed = ""
				m.Downloads[i].Phase = "done"
				cmds = append(cmds, m.Downloads[i].Progress.SetPercent(1.0))
				// Slot freed!
				cmds = append(cmds, m.checkNextDownload())
			}
		}

	case DownloadErrorMsg:
		for i := range m.Downloads {
			if m.Downloads[i].ID == msg.ID {
				if m.Downloads[i].Phase == "cancelled" {
					break // already marked cancelled, suppress error
				}
				m.Downloads[i].Status = fmt.Sprintf("Failed: %s", msg.Err.Error())
				m.Downloads[i].Phase = "error"
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m ForgeModel) checkNextDownload() tea.Cmd {
	activeCount := 0
	for _, d := range m.Downloads {
		if d.Phase == "downloading" || d.Phase == "processing" {
			activeCount++
		}
	}

	if activeCount >= config.C.MaxConcurrent {
		return nil
	}

	// Find the first waiting download and start it
	for i := range m.Downloads {
		if m.Downloads[i].Phase == "waiting" {
			d := &m.Downloads[i]
			ctx, cancel := context.WithCancel(context.Background())
			_ = ctx // context available for future use in engine
			d.Cancel = cancel
			d.Phase = "downloading"
			d.Status = "Starting..."
			return tea.Batch(
				StartDownloadCmd(d.URL, d.ID, d.ProgressChan, cancel),
				WaitForProgressCmd(d.ID, d.ProgressChan),
			)
		}
	}

	return nil
}

func (m ForgeModel) View() string {
	var sb strings.Builder

	if len(m.Downloads) == 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(LightGray)
		sb.WriteString("\n\n  " + emptyStyle.Render("No downloads yet.") + "\n")
		sb.WriteString("  " + emptyStyle.Render("Go to the Search tab, find a track, and press Enter to start downloading.") + "\n")
		return sb.String()
	}

	sb.WriteString("\n")

	for i, d := range m.Downloads {
		// Cursor
		cursor := "  "
		if i == m.Cursor {
			cursor = lipgloss.NewStyle().Foreground(PrimaryColor).Render("▶ ")
		}

		// ── Icon ──────────────────────────────────────────────────────────
		var icon string
		switch d.Phase {
		case "done":
			icon = lipgloss.NewStyle().Foreground(SuccessColor).Render("✓")
		case "error":
			icon = lipgloss.NewStyle().Foreground(ErrorColor).Render("✗")
		case "cancelled":
			icon = lipgloss.NewStyle().Foreground(LightGray).Render("⊘")
		case "downloading", "processing":
			icon = d.Spinner.View()
		default:
			icon = lipgloss.NewStyle().Foreground(LightGray).Render("·")
		}

		// ── Title (phase-colored, truncated) ──────────────────────────────
		maxTitleLen := m.Width - 42
		if maxTitleLen < 16 {
			maxTitleLen = 16
		}
		title := d.Title
		if len(title) > maxTitleLen {
			title = title[:maxTitleLen-1] + "…"
		}
		var titleStyle lipgloss.Style
		switch d.Phase {
		case "done":
			titleStyle = lipgloss.NewStyle().Foreground(SuccessColor).Bold(true)
		case "downloading", "processing":
			titleStyle = lipgloss.NewStyle().Foreground(WhiteColor).Bold(true)
		case "error":
			titleStyle = lipgloss.NewStyle().Foreground(ErrorColor)
		default:
			titleStyle = lipgloss.NewStyle().Foreground(LightGray)
		}
		titleStr := titleStyle.Render(title)

		// ── Right-side status ─────────────────────────────────────────────
		var right string
		switch d.Phase {
		case "downloading":
			pct := d.Progress.Percent()
			bar := lipgloss.NewStyle().Foreground(PrimaryColor).Render(miniBar(pct, 10))
			pctLabel := lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true).Render(fmt.Sprintf("%3.0f%%", pct*100))
			speed := lipgloss.NewStyle().Foreground(LightGray).Render(d.Speed)
			right = bar + "  " + pctLabel + "  " + speed
		case "processing":
			right = lipgloss.NewStyle().Foreground(AccentColor).Bold(true).Render(d.Status)
		case "done":
			right = lipgloss.NewStyle().Foreground(SuccessColor).Render("saved ✓")
		case "error":
			msg := d.Status
			if len(msg) > 28 {
				msg = msg[:27] + "…"
			}
			right = lipgloss.NewStyle().Foreground(ErrorColor).Render(msg)
		case "cancelled":
			right = lipgloss.NewStyle().Foreground(LightGray).Render("cancelled")
		default:
			right = lipgloss.NewStyle().Foreground(LightGray).Render("queued")
		}

		sb.WriteString(fmt.Sprintf("%s%s  %s  %s\n", cursor, icon, titleStr, right))
	}

	// ── Summary bar ────────────────────────────────────────────────────────
	var nDone, nActive, nQueued, nFailed int
	for _, d := range m.Downloads {
		switch d.Phase {
		case "done":
			nDone++
		case "downloading", "processing":
			nActive++
		case "error", "cancelled":
			nFailed++
		default:
			nQueued++
		}
	}
	total := len(m.Downloads)
	sb.WriteString("\n")

	dim := lipgloss.NewStyle().Foreground(LightGray)
	green := lipgloss.NewStyle().Foreground(SuccessColor).Bold(true)
	blue := lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true)
	red := lipgloss.NewStyle().Foreground(ErrorColor)

	line := fmt.Sprintf("  %d of %d  ·  ", nDone+nActive+nFailed, total)
	line += green.Render(fmt.Sprintf("%d done", nDone))
	if nActive > 0 {
		line += dim.Render("  ·  ") + blue.Render(fmt.Sprintf("%d active", nActive))
	}
	if nQueued > 0 {
		line += dim.Render(fmt.Sprintf("  ·  %d queued", nQueued))
	}
	if nFailed > 0 {
		line += dim.Render("  ·  ") + red.Render(fmt.Sprintf("%d failed", nFailed))
	}
	sb.WriteString(line + "\n")

	return sb.String()
}

// miniBar renders a compact █░ progress bar at a fixed character width.
func miniBar(percent float64, width int) string {
	if percent < 0 {
		percent = 0
	}
	if percent > 1 {
		percent = 1
	}
	filled := int(percent * float64(width))
	return strings.Repeat("█", filled) + strings.Repeat("░", width-filled)
}

// DownloadProgressMsg bridges the ingest channel to bubbletea
type DownloadProgressMsg struct {
	ID      int
	Percent float64
	Speed   string
	Status  string
	Phase   string
}

type DownloadDoneMsg int

type DownloadErrorMsg struct {
	ID  int
	Err error
}

func WaitForProgressCmd(id int, ch chan ingest.Progress) tea.Cmd {
	return func() tea.Msg {
		p, ok := <-ch
		if !ok {
			return DownloadDoneMsg(id)
		}
		return DownloadProgressMsg{
			ID:      id,
			Percent: p.Percent,
			Speed:   p.Speed,
			Status:  p.Status,
			Phase:   p.Phase,
		}
	}
}

func StartDownloadCmd(url string, id int, ch chan ingest.Progress, cancel context.CancelFunc) tea.Cmd {
	return func() tea.Msg {
		opts := ingest.DownloadOptions{
			Mode:            "audio",
			Quality:         config.C.Quality,
			Connections:     config.C.Connections,
			Splits:          config.C.Splits,
			UserAgent:       config.C.UserAgent,
			DestinationPath: config.C.OutputDir,
		}
		err := ingest.Download(url, opts, ch)
		cancel() // release context resources
		if err != nil {
			return DownloadErrorMsg{ID: id, Err: err}
		}
		return nil
	}
}
