package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"entropy-cli/internal/ingest"
)

type Download struct {
	ID           int
	URL          string
	Title        string
	Progress     progress.Model
	Spinner      spinner.Model
	Speed        string
	Status       string
	Phase        string // "waiting", "downloading", "processing", "done", "error"
	ProgressChan chan ingest.Progress
}

type ForgeModel struct {
	Downloads []Download
	Width     int
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
				m.Downloads[i].Status = "Saved to ~/Music"
				m.Downloads[i].Speed = ""
				m.Downloads[i].Phase = "done"
				cmds = append(cmds, m.Downloads[i].Progress.SetPercent(1.0))
			}
		}

	case DownloadErrorMsg:
		for i := range m.Downloads {
			if m.Downloads[i].ID == msg.ID {
				m.Downloads[i].Status = fmt.Sprintf("Failed: %s", msg.Err.Error())
				m.Downloads[i].Phase = "error"
			}
		}
	}

	return m, tea.Batch(cmds...)
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
	for _, d := range m.Downloads {
		// Status icon + label
		var icon, statusText string
		switch d.Phase {
		case "done":
			icon = lipgloss.NewStyle().Foreground(SuccessColor).Render("✓")
			statusText = lipgloss.NewStyle().Foreground(SuccessColor).Bold(true).Render("Done")
		case "error":
			icon = lipgloss.NewStyle().Foreground(ErrorColor).Render("✗")
			statusText = lipgloss.NewStyle().Foreground(ErrorColor).Bold(true).Render(d.Status)
		case "processing":
			icon = d.Spinner.View()
			statusText = lipgloss.NewStyle().Foreground(AccentColor).Bold(true).Render(d.Status)
		case "downloading":
			icon = d.Spinner.View()
			statusStr := d.Status
			if d.Speed != "" {
				statusStr += "  " + d.Speed
			}
			statusText = lipgloss.NewStyle().Foreground(PrimaryColor).Bold(true).Render(statusStr)
		default:
			icon = lipgloss.NewStyle().Foreground(LightGray).Render("·")
			statusText = lipgloss.NewStyle().Foreground(LightGray).Render("Waiting to start...")
		}

		// Title (truncated if needed)
		maxTitleLen := m.Width - 20
		if maxTitleLen < 20 {
			maxTitleLen = 20
		}
		title := d.Title
		if len(title) > maxTitleLen {
			title = title[:maxTitleLen-3] + "..."
		}
		titleStr := lipgloss.NewStyle().Bold(true).Foreground(WhiteColor).Render(title)

		sb.WriteString(fmt.Sprintf("  %s  %s\n", icon, titleStr))
		sb.WriteString(fmt.Sprintf("     %s\n", statusText))
		if d.Phase != "error" {
			sb.WriteString(fmt.Sprintf("     %s\n", d.Progress.View()))
		}
		sb.WriteString("\n")
	}

	return sb.String()
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

func StartDownloadCmd(url string, id int, ch chan ingest.Progress) tea.Cmd {
	return func() tea.Msg {
		home, _ := os.UserHomeDir()
		musicPath := filepath.Join(home, "Music")

		opts := ingest.DownloadOptions{
			Mode:            "audio",
			Quality:         "mp3",
			Connections:     16,
			Splits:          16,
			UserAgent:       "Mozilla/5.0",
			DestinationPath: musicPath,
		}
		err := ingest.Download(url, opts, ch)
		if err != nil {
			return DownloadErrorMsg{ID: id, Err: err}
		}
		return nil
	}
}
