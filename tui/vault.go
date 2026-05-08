package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/copiuumgroup/entropy-cli/internal/config"
	"github.com/dhowden/tag"
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

type SortMode int

const (
	SortByArtist SortMode = iota
	SortByTitle
	SortBySize
	SortByDate
)

func (s SortMode) String() string {
	switch s {
	case SortByArtist:
		return "Artist"
	case SortByTitle:
		return "Title"
	case SortBySize:
		return "Size"
	case SortByDate:
		return "Date added"
	}
	return ""
}

type VaultItem struct {
	Name     string
	Path     string
	Ext      string
	Size     int64
	ModTime  time.Time
	TagTitle  string
	TagArtist string
	TagDur    int // seconds, from tag if available
}

func (i VaultItem) displayTitle() string {
	if i.TagTitle != "" {
		return i.TagTitle
	}
	return strings.TrimSuffix(i.Name, filepath.Ext(i.Name))
}

func (i VaultItem) displayArtist() string {
	if i.TagArtist != "" {
		return i.TagArtist
	}
	return ""
}

func (i VaultItem) Title() string { return i.displayTitle() }
func (i VaultItem) Description() string {
	ext := strings.ToUpper(strings.TrimPrefix(i.Ext, "."))
	sizeMB := float64(i.Size) / 1024 / 1024
	var sizeStr string
	if sizeMB >= 1 {
		sizeStr = fmt.Sprintf("%.1f MB", sizeMB)
	} else {
		sizeStr = fmt.Sprintf("%.0f KB", float64(i.Size)/1024)
	}

	parts := []string{ext, sizeStr}
	if i.TagArtist != "" {
		parts = append([]string{i.TagArtist}, parts...)
	}
	if i.TagDur > 0 {
		parts = append(parts, fmt.Sprintf("%d:%02d", i.TagDur/60, i.TagDur%60))
	}
	return strings.Join(parts, "  ·  ")
}
func (i VaultItem) FilterValue() string { return i.displayTitle() + " " + i.displayArtist() }

type VaultModel struct {
	List     list.Model
	SortBy   SortMode
	AllItems []VaultItem
	Keys     VaultKeyMap
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
		m.AllItems = msg.Files
		m.applySort()
		if len(m.AllItems) > 0 {
			m.List.Title = fmt.Sprintf("Music Library  ·  %d tracks  ·  Sort: %s", len(m.AllItems), m.SortBy)
		} else {
			m.List.Title = "Music Library"
		}
		cmd = m.List.SetItems(toListItems(m.AllItems))
		cmds = append(cmds, cmd)

	case tea.KeyMsg:
		switch msg.String() {
		case "r":
			// Manual rescan
			cmds = append(cmds, ScanVaultCmd())
			return m, tea.Batch(cmds...)
		case "s":
			// Cycle sort mode
			m.SortBy = (m.SortBy + 1) % 4
			m.applySort()
			m.List.Title = fmt.Sprintf("Music Library  ·  %d tracks  ·  Sort: %s", len(m.AllItems), m.SortBy)
			cmd = m.List.SetItems(toListItems(m.AllItems))
			cmds = append(cmds, cmd)
			return m, tea.Batch(cmds...)
		case "x", "delete":
			// Delete selected file
			if sel, ok := m.List.SelectedItem().(VaultItem); ok {
				if err := os.Remove(sel.Path); err == nil {
					cmds = append(cmds, ScanVaultCmd())
				}
			}
			return m, tea.Batch(cmds...)
		}
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)

	case tea.MouseMsg:
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m *VaultModel) applySort() {
	items := make([]VaultItem, len(m.AllItems))
	copy(items, m.AllItems)
	switch m.SortBy {
	case SortByArtist:
		sort.Slice(items, func(i, j int) bool {
			a := strings.ToLower(items[i].TagArtist + items[i].displayTitle())
			b := strings.ToLower(items[j].TagArtist + items[j].displayTitle())
			return a < b
		})
	case SortByTitle:
		sort.Slice(items, func(i, j int) bool {
			return strings.ToLower(items[i].displayTitle()) < strings.ToLower(items[j].displayTitle())
		})
	case SortBySize:
		sort.Slice(items, func(i, j int) bool {
			return items[i].Size > items[j].Size
		})
	case SortByDate:
		sort.Slice(items, func(i, j int) bool {
			return items[i].ModTime.After(items[j].ModTime)
		})
	}
	m.AllItems = items
}

func toListItems(items []VaultItem) []list.Item {
	out := make([]list.Item, len(items))
	for i, v := range items {
		out[i] = v
	}
	return out
}

func (m VaultModel) View() string {
	if len(m.List.Items()) == 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(LightGray)
		pathStyle := lipgloss.NewStyle().Foreground(PrimaryColor)
		var sb strings.Builder
		sb.WriteString("\n\n  " + emptyStyle.Render("Your music library is empty.") + "\n")
		outDir := config.C.OutputDir
		if outDir != "" {
			sb.WriteString("  " + emptyStyle.Render("Files will appear here once you download them.") + "\n")
			sb.WriteString("  " + emptyStyle.Render("Library folder: ") + pathStyle.Render(outDir) + "\n")
		}
		return sb.String()
	}
	return m.List.View()
}

// VaultMsg carries the scanned file list back to the model
type VaultMsg struct {
	Files []VaultItem
}

func ScanVaultCmd() tea.Cmd {
	return func() tea.Msg {
		outDir := config.C.OutputDir
		if outDir == "" {
			home, _ := os.UserHomeDir()
			outDir = filepath.Join(home, "Music")
		}

		files, err := os.ReadDir(outDir)
		if err != nil {
			return VaultMsg{}
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
			var modTime time.Time
			if info != nil {
				size = info.Size()
				modTime = info.ModTime()
			}

			fullPath := filepath.Join(outDir, f.Name())
			item := VaultItem{
				Name:    f.Name(),
				Path:    fullPath,
				Ext:     ext,
				Size:    size,
				ModTime: modTime,
			}

			// Read ID3/FLAC/OGG tags
			if tf, err := os.Open(fullPath); err == nil {
				if m, err := tag.ReadFrom(tf); err == nil {
					item.TagTitle = m.Title()
					item.TagArtist = m.Artist()
				}
				tf.Close()
			}

			vaultFiles = append(vaultFiles, item)
		}

		return VaultMsg{Files: vaultFiles}
	}
}
