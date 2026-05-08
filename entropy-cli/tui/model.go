package tui

import (
	"fmt"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"entropy-cli/internal/ingest"
)

type tab int

const (
	tabSearch tab = iota
	tabForge
	tabVault
)

type ErrorMsg struct {
	Err error
}

type RootModel struct {
	Width        int
	Height       int
	ActiveTab    tab
	Search       SearchModel
	Forge        ForgeModel
	Vault        VaultModel
	Help         help.Model
	Keys         GlobalKeyMap
	Quitting     bool
	ConfirmQuit  bool
	ShowSplash   bool
}

func NewRootModel() RootModel {
	return RootModel{
		ActiveTab:  tabSearch,
		Search:     NewSearchModel(),
		Forge:      NewForgeModel(),
		Vault:      NewVaultModel(),
		Help:       help.New(),
		Keys:       GlobalKeys(),
		ShowSplash: true,
	}
}

func (m RootModel) Init() tea.Cmd {
	return tea.Batch(
		m.Search.Init(),
		m.Forge.Init(),
		m.Vault.Init(),
		TickCmd(),
	)
}

func (m RootModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.ShowSplash {
			// Any key dismisses the splash screen
			m.ShowSplash = false
			return m, nil
		}

		if key.Matches(msg, m.Keys.Quit) {
			if m.ConfirmQuit {
				m.Quitting = true
				return m, tea.Quit
			}
			m.ConfirmQuit = true
			return m, nil
		}

		if m.ConfirmQuit {
			if msg.String() == "y" || msg.String() == "Y" || msg.String() == "enter" {
				m.Quitting = true
				return m, tea.Quit
			}
			m.ConfirmQuit = false
			return m, nil
		}

		if key.Matches(msg, m.Keys.Help) {
			m.Help.ShowAll = !m.Help.ShowAll
			return m, nil
		}

		// Only handle tab switching if not searching (typing in input)
		if !m.Search.Input.Focused() {
			if key.Matches(msg, m.Keys.NextTab) {
				m.ActiveTab = (m.ActiveTab + 1) % 3
				if m.ActiveTab == tabVault {
					cmds = append(cmds, ScanVaultCmd())
				}
				return m, tea.Batch(cmds...)
			}
			if key.Matches(msg, m.Keys.PrevTab) {
				m.ActiveTab = (m.ActiveTab - 1 + 3) % 3
				if m.ActiveTab == tabVault {
					cmds = append(cmds, ScanVaultCmd())
				}
				return m, tea.Batch(cmds...)
			}
			if key.Matches(msg, m.Keys.FocusSearch) {
				m.ActiveTab = tabSearch
				cmd := m.Search.Input.Focus()
				return m, cmd
			}
		}

	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.Help.Width = msg.Width

		m.Search, cmd = m.Search.Update(msg)
		cmds = append(cmds, cmd)

		m.Forge, cmd = m.Forge.Update(msg)
		cmds = append(cmds, cmd)

		m.Vault, cmd = m.Vault.Update(msg)
		cmds = append(cmds, cmd)

		return m, tea.Batch(cmds...)

	case TickMsg:
		cmds = append(cmds, TickCmd())

	// Route global messages to components
	case DownloadProgressMsg, DownloadDoneMsg:
		m.Forge, cmd = m.Forge.Update(msg)
		cmds = append(cmds, cmd)
		// If download done, might want to refresh vault
		if _, ok := msg.(DownloadDoneMsg); ok {
			cmds = append(cmds, ScanVaultCmd())
		}
	}

	// Route specific messages based on active tab
	if !m.ShowSplash {
		switch m.ActiveTab {
		case tabSearch:
			m.Search, cmd = m.Search.Update(msg)
			cmds = append(cmds, cmd)
			// Intercept SearchResultMsg or Enter to trigger Download
			if keyMsg, ok := msg.(tea.KeyMsg); ok {
				if key.Matches(keyMsg, m.Search.Keys.Enter) && !m.Search.Input.Focused() {
					if i, ok := m.Search.List.SelectedItem().(ResultItem); ok {
						newID := len(m.Forge.Downloads)
						ch := make(chan ingest.Progress)
						m.Forge.Downloads = append(m.Forge.Downloads, Download{
							ID:           newID,
							URL:          i.URL,
							Title:        i.TrackTitle,
							Status:       "Starting",
							ProgressChan: ch,
						})
						cmds = append(cmds, StartDownloadCmd(i.URL, newID, ch))
						cmds = append(cmds, WaitForProgressCmd(newID, ch))
						m.ActiveTab = tabForge // auto switch to forge
					}
				}
			}
		case tabForge:
			m.Forge, cmd = m.Forge.Update(msg)
			cmds = append(cmds, cmd)
		case tabVault:
			m.Vault, cmd = m.Vault.Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	return m, tea.Batch(cmds...)
}

func (m RootModel) View() string {
	if m.Quitting {
		return "\n  Exiting Entropy CLI...\n"
	}

	if m.ConfirmQuit {
		prompt := "\n\n\n\n\n\n\n" +
			lipgloss.NewStyle().Foreground(ErrorColor).Bold(true).Render(" Are you sure you want to exit? ") + "\n\n" +
			lipgloss.NewStyle().Foreground(LightGray).Render("Press Y or Enter to confirm, any other key to cancel.")
		return lipgloss.Place(m.Width, m.Height, lipgloss.Center, lipgloss.Center, prompt)
	}

	if m.ShowSplash {
		splashContent := "\n\n\n\n\n\n\n" +
			TitleStyle.Render(" ENTROPY INGEST SUITE ") + "\n\n" +
			lipgloss.NewStyle().Foreground(LightGray).Render("by copiuum group") + "\n\n\n" +
			lipgloss.NewStyle().Foreground(GrayColor).Render("Press any key to continue...")
		return lipgloss.Place(m.Width, m.Height, lipgloss.Center, lipgloss.Center, splashContent)
	}

	// Tabs Header
	tabs := []string{"Search", "Downloads", "~/Music"}
	if len(m.Forge.Downloads) > 0 {
		tabs[1] = fmt.Sprintf("Downloads (%d)", len(m.Forge.Downloads))
	}

	var renderedTabs []string
	for i, t := range tabs {
		if i == int(m.ActiveTab) {
			renderedTabs = append(renderedTabs, ActiveTabStyle.Render(t))
		} else {
			renderedTabs = append(renderedTabs, InactiveTabStyle.Render(t))
		}
	}
	tabRow := lipgloss.NewStyle().PaddingTop(1).Render(lipgloss.JoinHorizontal(lipgloss.Top, renderedTabs...))

	// Main Content Area
	var content string
	switch m.ActiveTab {
	case tabSearch:
		content = m.Search.View()
	case tabForge:
		content = m.Forge.View()
	case tabVault:
		content = m.Vault.View()
	}
	
	// Help Footer
	var helpView string
	switch m.ActiveTab {
	case tabSearch:
		helpView = m.Help.View(m.Search.Keys)
	case tabForge:
		helpView = m.Help.View(m.Forge.Keys)
	case tabVault:
		helpView = m.Help.View(m.Vault.Keys)
	}
	helpBox := HelpStyle.Render(helpView)

	// Calculate remaining height for content
	h, v := BaseStyle.GetFrameSize()
	tabHeight := lipgloss.Height(tabRow)
	helpHeight := lipgloss.Height(helpBox)
	
	contentHeight := m.Height - tabHeight - helpHeight - v
	if contentHeight < 10 { contentHeight = 10 }
	
	contentBox := lipgloss.NewStyle().
		Width(m.Width - h).
		Height(contentHeight).
		Render(content)
		
	ui := lipgloss.JoinVertical(lipgloss.Left,
		tabRow,
		BaseStyle.Render(contentBox),
		helpBox,
	)

	return lipgloss.Place(m.Width, m.Height, lipgloss.Left, lipgloss.Top, ui)
}

// TickMsg and TickCmd for periodic updates
type TickMsg time.Time

func TickCmd() tea.Cmd {
	return tea.Every(time.Millisecond*100, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

// Implement help.KeyMap for context menus
func (k SearchKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.ToggleProvider, k.Enter, k.Cancel}
}
func (k SearchKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.ToggleProvider, k.Enter, k.Cancel}}
}

func (k ForgeKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Cancel}
}
func (k ForgeKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Cancel}}
}

func (k VaultKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Play, k.Delete}
}
func (k VaultKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.Play, k.Delete}}
}
