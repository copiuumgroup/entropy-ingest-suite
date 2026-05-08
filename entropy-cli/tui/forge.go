package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"entropy-cli/internal/ingest"
)

type Download struct {
	ID           int
	URL          string
	Title        string
	Progress     progress.Model
	Speed        string
	Status       string
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
			m.Downloads[i].Progress.Width = msg.Width - 20
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
				cmds = append(cmds, m.Downloads[i].Progress.SetPercent(msg.Percent))
				cmds = append(cmds, WaitForProgressCmd(msg.ID, m.Downloads[i].ProgressChan))
			}
		}

	case DownloadDoneMsg:
		for i := range m.Downloads {
			if m.Downloads[i].ID == int(msg) {
				m.Downloads[i].Status = "Ready in ~/Music"
				m.Downloads[i].Speed = ""
			}
		}
	}

	return m, tea.Batch(cmds...)
}

func (m ForgeModel) View() string {
	var sb strings.Builder
	if len(m.Downloads) == 0 {
		sb.WriteString("\n\n  " + lipgloss.NewStyle().Foreground(LightGray).Render("No active downloads.") + "\n")
		sb.WriteString("  " + lipgloss.NewStyle().Foreground(LightGray).Render("Switch to the Search tab to begin.") + "\n")
	} else {
		sb.WriteString("\n")
		for _, d := range m.Downloads {
			sb.WriteString(fmt.Sprintf("%s %s\n", StatusStyle.Render(d.Status), d.Title))
			sb.WriteString(fmt.Sprintf("%s  %s\n\n\n", d.Progress.View(), StatusStyle.Render(d.Speed)))
		}
	}
	return sb.String()
}

// DownloadProgressMsg bridges the ingest channel to bubbletea
type DownloadProgressMsg struct {
	ID      int
	Percent float64
	Speed   string
	Status  string
}

type DownloadDoneMsg int

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
			return ErrorMsg{Err: err}
		}
		return nil
	}
}
