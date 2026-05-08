package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

var audioExtensions = map[string]bool{
	".mp3":  true,
	".flac": true,
	".wav":  true,
	".aac":  true,
	".ogg":  true,
	".m4a":  true,
	".opus": true,
	".wma":  true,
}

type VaultItem struct {
	Name string
	Path string
	Ext  string
	Size int64
}

func (i VaultItem) Title() string { return strings.TrimSuffix(i.Name, filepath.Ext(i.Name)) }
func (i VaultItem) Description() string {
	ext := strings.ToUpper(strings.TrimPrefix(i.Ext, "."))
	sizeMB := float64(i.Size) / 1024 / 1024
	if sizeMB >= 1 {
		return fmt.Sprintf("%s  ·  %.1f MB", ext, sizeMB)
	}
	sizeKB := float64(i.Size) / 1024
	return fmt.Sprintf("%s  ·  %.0f KB", ext, sizeKB)
}
func (i VaultItem) FilterValue() string { return i.Name }

type VaultModel struct {
	List      list.Model
	MusicPath string
	Keys      VaultKeyMap
}

func NewVaultModel() VaultModel {
	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.
		Foreground(PrimaryColor).
		BorderLeftForeground(PrimaryColor)
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.
		Foreground(SecondaryColor).
		BorderLeftForeground(PrimaryColor)

	l := list.New([]list.Item{}, delegate, 0, 0)
	l.Title = "Music Library"
	l.SetShowStatusBar(true)
	l.SetFilteringEnabled(true)
	l.SetShowHelp(false)
	l.Styles.Title = lipgloss.NewStyle().
		Foreground(PrimaryColor).
		Bold(true).
		Padding(0, 1)

	return VaultModel{
		List: l,
		Keys: VaultKeys(),
	}
}

func (m VaultModel) Init() tea.Cmd {
	return ScanVaultCmd()
}

func (m VaultModel) Update(msg tea.Msg) (VaultModel, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h, v := BaseStyle.GetFrameSize()
		m.List.SetSize(msg.Width-h, msg.Height-v-10)

	case VaultMsg:
		m.MusicPath = msg.Path
		var items []list.Item
		for _, f := range msg.Files {
			items = append(items, f)
		}
		// Update list title to show count
		if len(items) > 0 {
			m.List.Title = fmt.Sprintf("Music Library  ·  %d tracks", len(items))
		} else {
			m.List.Title = "Music Library"
		}
		cmd = m.List.SetItems(items)
		cmds = append(cmds, cmd)

	case tea.KeyMsg:
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case tea.MouseMsg:
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m VaultModel) View() string {
	if len(m.List.Items()) == 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(LightGray)
		pathStyle := lipgloss.NewStyle().Foreground(PrimaryColor)
		var sb strings.Builder
		sb.WriteString("\n\n  " + emptyStyle.Render("Your music library is empty.") + "\n")
		if m.MusicPath != "" {
			sb.WriteString("  " + emptyStyle.Render("Files will appear here once you download them.") + "\n")
			sb.WriteString("  " + emptyStyle.Render("Library folder: ") + pathStyle.Render(m.MusicPath) + "\n")
		}
		return sb.String()
	}
	return m.List.View()
}

// VaultMsg carries the scanned file list back to the model
type VaultMsg struct {
	Files []VaultItem
	Path  string
}

func ScanVaultCmd() tea.Cmd {
	return func() tea.Msg {
		home, _ := os.UserHomeDir()
		musicPath := filepath.Join(home, "Music")

		files, err := os.ReadDir(musicPath)
		if err != nil {
			return VaultMsg{Path: musicPath}
		}

		var vaultFiles []VaultItem
		for _, f := range files {
			if f.IsDir() {
				continue
			}
			ext := strings.ToLower(filepath.Ext(f.Name()))
			if !audioExtensions[ext] {
				continue
			}
			info, _ := f.Info()
			var size int64
			if info != nil {
				size = info.Size()
			}
			vaultFiles = append(vaultFiles, VaultItem{
				Name: f.Name(),
				Path: filepath.Join(musicPath, f.Name()),
				Ext:  ext,
				Size: size,
			})
		}

		return VaultMsg{Files: vaultFiles, Path: musicPath}
	}
}
