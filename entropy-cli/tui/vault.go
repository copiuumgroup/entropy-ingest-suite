package tui

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type VaultItem struct {
	Name string
	Path string
}

func (i VaultItem) Title() string       { return i.Name }
func (i VaultItem) Description() string { return i.Path }
func (i VaultItem) FilterValue() string { return i.Name }

type VaultModel struct {
	List list.Model
	Keys VaultKeyMap
}

func NewVaultModel() VaultModel {
	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.Foreground(PrimaryColor).BorderLeftForeground(PrimaryColor)
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.Foreground(PrimaryColor).BorderLeftForeground(PrimaryColor)

	l := list.New([]list.Item{}, delegate, 0, 0)
	l.Title = "Local Archive"
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(true)

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
		var items []list.Item
		for _, f := range msg {
			items = append(items, VaultItem{
				Name: f,
				Path: "~/Music",
			})
		}
		cmd = m.List.SetItems(items)
		cmds = append(cmds, cmd)

	case tea.KeyMsg:
		// Not implementing play/delete in this simple prototype yet
		m.List, cmd = m.List.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m VaultModel) View() string {
	if len(m.List.Items()) == 0 {
		return "\n\n  " + lipgloss.NewStyle().Foreground(LightGray).Render("Your archive is currently empty.") + "\n"
	}
	return m.List.View()
}

type VaultMsg []string

func ScanVaultCmd() tea.Cmd {
	return func() tea.Msg {
		home, _ := os.UserHomeDir()
		musicPath := filepath.Join(home, "Music")

		files, err := os.ReadDir(musicPath)
		if err != nil {
			return VaultMsg([]string{})
		}
		var vaultFiles []string
		for _, f := range files {
			if !f.IsDir() && strings.HasSuffix(f.Name(), ".mp3") {
				vaultFiles = append(vaultFiles, f.Name())
			}
		}
		return VaultMsg(vaultFiles)
	}
}
